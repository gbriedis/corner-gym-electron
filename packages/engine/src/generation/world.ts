// generateWorld produces a complete WorldState from a GameConfig.
//
// Generation order:
// 1. Initialise RNG from config.seed — all randomness flows through this single
//    seeded RNG so the same seed + config always produces the same world.
// 2. For each rendered nation — collect its cities from the loaded game data.
// 3. For each city — generate the population. Population count is scaled by
//    the talentDensity difficulty modifier; a harder game produces fewer people
//    to recruit from. City population is rounded up so every city has at least 1.
// 4. For each city — generate gyms using gym-starting-state templates.
//    Gym count = gymsPerCity[city.population] × city.rivalGymDensity (min 1).
// 5. Distribute city persons across gyms using weighted random (weight = lockerCount).
//    Gyms are guaranteed at least 1 member before weighted distribution begins.
//    Persons who cannot fit in any gym remain as free agents in the world.
// 6. Identify fighters within each gym. Not every gym member boxes competitively —
//    reason-for-boxing and soul traits determine who is a Fighter.
// 7. Assign an initial head coach to each gym from its fighter roster.
// 8. Return the complete WorldState plus flat Person[], Fighter[], and Gym[] arrays.

import { createRng } from '../utils/rng.js'
import { generatePerson } from './person.js'
import { generateFighter } from './fighter.js'
import { generateGym } from './gym.js'
import { generateCalendar } from './calendar.js'

import type { GameData } from '../data/loader.js'
import type { GameConfig } from '../types/gameConfig.js'
import { resolveModifiers } from '../types/gameConfig.js'
import type { WorldState, NationState, CityState } from '../types/worldState.js'
import type { Person } from '../types/person.js'
import type { Fighter } from '../types/fighter.js'
import type { Gym, GymStaffMember } from '../types/gym.js'
import type { CalendarEvent } from '../types/calendar.js'

// shouldBeFighter determines whether a gym member is generated as a Fighter.
// Not every person who trains at a gym is a competitive boxer — many are regulars,
// fitness members, or people who came for the community and never competed.
function shouldBeFighter(person: Person, rng: ReturnType<typeof createRng>): boolean {
  const reason = person.reasonForBoxingId
  const traits = new Set(person.soulTraits.map(t => t.traitId))

  // Survival-motivated or passion-driven people always fight — the sport is their identity.
  if (reason === 'way_out' || reason === 'prove_something' || reason === 'passion') {
    return true
  }

  // Casual entry + content disposition = boxing as a hobby, not a career.
  // 80% of these people never compete, and the 20% who do were surprised by themselves.
  if (
    (reason === 'outlet' || reason === 'fell_into_it' || reason === 'friend_brought_me') &&
    traits.has('content')
  ) {
    return rng.next() >= 0.80
  }

  // Middle ground: most people in a boxing gym at least try competing once.
  return rng.next() < 0.60
}

export function generateWorld(
  config: GameConfig,
  data: GameData,
): { worldState: WorldState; persons: Person[]; fighters: Fighter[]; gyms: Gym[]; calendar: CalendarEvent[] } {
  // Step 1 — Initialise RNG from config.seed.
  // Seeding here ensures reproducibility: given the same config.seed,
  // every nation, city, person, and gym is generated identically.
  const rng = createRng(config.seed)

  // Resolve partial difficulty modifiers to full values before any generation runs.
  // Doing this once at entry rather than at each use site prevents scattered ?? 1.0
  // expressions throughout the generation code and makes the fallback policy explicit.
  const modifiers = resolveModifiers(config.difficultyModifiers)

  const allPersons: Person[] = []
  const allFighters: Fighter[] = []
  const allGyms: Gym[] = []
  const nations: Record<string, NationState> = {}
  const cities: Record<string, CityState> = {}
  const gymsById: Record<string, Gym> = {}

  let playerGymId = ''

  // Step 2 — For each rendered nation, process its cities.
  // renderedNations controls which nations are active in this save — not all loaded
  // nations need to be simulated. Only rendered nations generate population and gyms.
  for (const nationId of config.renderedNations) {
    const bundle = data.nations[nationId]
    if (bundle === undefined) {
      throw new Error(`Rendered nation "${nationId}" not found in loaded game data`)
    }

    const cityIds: string[] = []

    for (const city of bundle.cities.cities) {
      // Step 3 — For each city, generate population.
      // Base count comes from the tier-specific populationPerCity value — capitals generate
      // far more fighters than small towns, reflecting real population differences.
      // talentDensity < 1.0 (hard/extreme) further reduces the count, making recruitment harder.
      // We round up to ensure every city has at least one person.
      const baseCount = config.worldSettings.populationPerCity[city.population] ?? 150
      const rawCount = baseCount * modifiers.talentDensity
      const personCount = Math.max(1, Math.round(rawCount))

      const cityPersons: Person[] = []
      for (let i = 0; i < personCount; i++) {
        cityPersons.push(generatePerson(data, rng, nationId, city.id))
      }
      allPersons.push(...cityPersons)

      // Step 4 — Generate gyms for this city.
      // Gym count scales with city size (gymsPerCity) and city's rivalGymDensity modifier.
      // The modifier reflects how developed the local boxing scene is — high-density cities
      // have more gyms competing for the same talent pool.
      // Cap at personCount: a gym with zero members cannot function as a gym — this also
      // prevents edge cases in test configs where population is set unrealistically low.
      const baseGymCount = config.worldSettings.gymsPerCity[city.population] ?? 1
      const rawGymCount  = Math.max(1, Math.round(baseGymCount * city.rivalGymDensity))
      const gymCount     = Math.min(rawGymCount, personCount)

      const cityGyms: Gym[] = []
      // Track used names within this city to prevent duplicate gym names.
      const usedNamesInCity = new Set<string>()

      for (let g = 0; g < gymCount; g++) {
        // First gym in the player's starting city is the player gym.
        // Using index 0 makes this deterministic — config changes do not shift the player gym slot.
        const isPlayerGym = city.id === config.playerCityId && g === 0

        const gymName = isPlayerGym ? config.gymName : null

        const gym = generateGym(
          city.id,
          nationId,
          isPlayerGym,
          gymName,
          data,
          rng,
          { startYear: config.startYear, usedNamesInCity },
        )

        if (isPlayerGym) {
          playerGymId = gym.id
        }

        usedNamesInCity.add(gym.name)
        cityGyms.push(gym)
        gymsById[gym.id] = gym
        allGyms.push(gym)
      }

      // Step 5 — Distribute persons across city gyms.
      // Pass 1: guarantee every gym gets at least one member before weighted distribution.
      // An empty gym has no community — the simulation needs at least one person per gym
      // to drive culture, word-of-mouth, and the conditions for a fighter to emerge.
      const personQueue = [...cityPersons]

      for (const gym of cityGyms) {
        if (personQueue.length === 0) break
        const person = personQueue.shift()!
        gym.memberIds.push(person.id)
      }

      // Pass 2: distribute remaining persons weighted by lockerCount.
      // Larger gyms attract more members — weight = total locker capacity, not remaining.
      // A gym is removed from the pool only once it reaches lockerCount, not before.
      for (const person of personQueue) {
        const available = cityGyms.filter(g => g.memberIds.length < g.lockerCount)
        if (available.length === 0) {
          // All gyms full — this person is a free agent.
          // They remain in the city's person pool without a gym assignment.
          continue
        }
        const weights = available.map(g => g.lockerCount)
        const chosen = rng.weightedPick(available, weights)
        chosen.memberIds.push(person.id)
      }

      // Step 6 — Identify fighters within each gym.
      // Generate Fighter records only for members who would realistically compete.
      // Coach assignment comes later — coachId is null at this stage.
      for (const gym of cityGyms) {
        for (const personId of gym.memberIds) {
          const person = cityPersons.find(p => p.id === personId)
          if (person === undefined) continue

          if (shouldBeFighter(person, rng)) {
            const fighter = generateFighter(person, gym.id, null, data, rng)
            gym.fighterIds.push(person.id)
            allFighters.push(fighter)
          }
        }
      }

      // Step 7 — Assign initial head coach to each gym.
      // Simple rule for world generation: the most experienced non-competing fighter
      // over 28 becomes head coach. isGymMemberFilling=true marks this as informal —
      // quality ceiling applies and wage is zero. A proper coaching system is deferred
      // to the full staff module.
      for (const gym of cityGyms) {
        const gymFighters = allFighters.filter(f => gym.fighterIds.includes(f.id))

        // Eligible: age > 28 and NOT in 'competing' identity state.
        // We prefer someone who has stepped back from competition — they have experience
        // to pass on and time to invest in coaching others.
        const eligible = gymFighters.filter(
          f => f.age > 28 && f.fighterIdentity.state !== 'competing',
        )

        if (eligible.length === 0) continue

        // Highest combined developed attributes = most technically rounded fighter.
        const headCoach = eligible.reduce((best, f) => {
          const totalBest = best.developedAttributes.reduce((s, a) => s + a.current, 0)
          const totalF   = f.developedAttributes.reduce((s, a) => s + a.current, 0)
          return totalF > totalBest ? f : best
        })

        const staffMember: GymStaffMember = {
          personId: headCoach.id,
          role: 'head_coach',
          startedYear: config.startYear,
          startedWeek: 1,
          wageMonthly: 0,
          isGymMemberFilling: true,
        }

        gym.staffMembers.push(staffMember)
      }

      cities[city.id] = {
        cityId: city.id,
        nationId,
        gymIds: cityGyms.map(g => g.id),
      }

      cityIds.push(city.id)
    }

    nations[nationId] = {
      nationId,
      cityIds,
    }
  }

  if (playerGymId === '') {
    throw new Error(
      `Player city "${config.playerCityId}" was not found in any rendered nation. ` +
      `Check that playerNationId "${config.playerNationId}" is in renderedNations.`,
    )
  }

  // Step 8 — Assemble WorldState.
  // saveId is assigned as an empty string here — the database layer assigns the real
  // ID when persisting the save. This keeps generation pure and ID-agnostic.
  const worldState: WorldState = {
    saveId: '',
    seed: config.seed,
    currentYear: config.startYear,
    currentWeek: 1,
    playerName: config.playerName,
    gymName: config.gymName,
    playerGymId,
    playerCityId: config.playerCityId,
    playerNationId: config.playerNationId,
    nations,
    cities,
    gyms: gymsById,
    // Rotation indices start at 0 — first national championship will use index 0
    // of its hostCityRotation. The calendar generator increments and stores back here.
    rotationIndices: {},
  }

  // Generate the calendar after world state is assembled so rotationIndices
  // can be updated in place on the worldState during generation.
  // Start at week 1 — the game always begins at the start of the year.
  const calendar = generateCalendar(
    config.startYear,
    1,
    config,
    data,
    rng,
    worldState,
  )

  return { worldState, persons: allPersons, fighters: allFighters, gyms: allGyms, calendar }
}
