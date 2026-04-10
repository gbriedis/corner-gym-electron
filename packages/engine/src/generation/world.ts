// generateWorld produces a complete WorldState from a GameConfig.
//
// Generation order:
// 1. Initialise RNG from config.seed — all randomness flows through this single
//    seeded RNG so the same seed + config always produces the same world.
// 2. For each rendered nation — collect its cities from the loaded game data.
// 3. For each city — generate gyms using gym-starting-state templates.
//    Gym count = gymsPerCity[city.population] × city.rivalGymDensity (min 1).
// 4. For each gym — generate fighters directly using the age cohort pyramid.
//    No generic Person pool. Every generated entity is a Fighter or a Coach.
//    casualMemberCount is set on each gym for revenue calculation.
// 5. Generate veteran career histories for fighters aged 29+.
//    Statistical generation only — not simulated.
// 6. Assign head coaches from retired fighters in each gym.
// 7. Return the complete WorldState plus flat Fighter[], Gym[], and Coach[] arrays.

import { createRng } from '../utils/rng.js'
import { generatePerson } from './person.js'
import { generateFighter } from './fighter.js'
import { generateGym, assignGymHeadCoach } from './gym.js'
import { generateCalendar } from './calendar.js'
import { generateVeteranCareer } from './veteranCareer.js'

import type { GameData } from '../data/loader.js'
import type { GameConfig } from '../types/gameConfig.js'
import { resolveModifiers } from '../types/gameConfig.js'
import type { WorldState, NationState, CityState } from '../types/worldState.js'
import type { Person } from '../types/person.js'
import type { Fighter, FighterIdentityState } from '../types/fighter.js'
import type { Gym } from '../types/gym.js'
import type { Coach } from '../types/coach.js'
import type { CalendarEvent } from '../types/calendar.js'

// AGE_COHORTS defines the age pyramid used when generating fighters for a gym.
// Each cohort has a fraction of the gym's fighter count and a [minAge, maxAge] range.
// The fractions sum to 1.0. Younger fighters dominate the base; older fighters taper off.
const AGE_COHORTS: Array<{ minAge: number; maxAge: number; fraction: number }> = [
  { minAge: 13, maxAge: 17, fraction: 0.15 },
  { minAge: 18, maxAge: 22, fraction: 0.25 },
  { minAge: 23, maxAge: 28, fraction: 0.30 },
  { minAge: 29, maxAge: 34, fraction: 0.20 },
  { minAge: 35, maxAge: 40, fraction: 0.10 },
]

// CASUAL_MEMBER_MULTIPLIERS maps gym template ids to the fraction of lockerCount
// that are casual (non-competing) members. Elite gyms have fewer casuals because
// they are primarily competition-focused; community gyms have more fitness members.
const CASUAL_MEMBER_MULTIPLIERS: Record<string, number> = {
  elite_gym:              0.25,
  competition_gym:        0.40,
  established_community:  0.55,
  rundown_community:      0.60,
}

// identityStateForCohort returns a plausible identity state bias for a fighter in a given age cohort.
// Younger fighters have not yet committed; older fighters are more likely competing or retired.
function identityStateForCohort(
  cohortIndex: number,
  rng: ReturnType<typeof createRng>,
): FighterIdentityState {
  switch (cohortIndex) {
    case 0: // 13-17: mostly unaware, some curious
      return rng.next() < 0.80 ? 'unaware' : 'curious'
    case 1: // 18-22: curious or aspiring
      return rng.next() < 0.30 ? 'curious' : 'aspiring'
    case 2: // 23-28: mostly aspiring, some competing
      return rng.next() < 0.20 ? 'aspiring' : 'competing'
    case 3: // 29-34: mostly competing, some retired
      return rng.next() < 0.90 ? 'competing' : 'retired'
    case 4: // 35-40: split competing/retired
      return rng.next() < 0.40 ? 'competing' : 'retired'
    default:
      return 'aspiring'
  }
}

export function generateWorld(
  config: GameConfig,
  data: GameData,
): { worldState: WorldState; persons: Person[]; fighters: Fighter[]; gyms: Gym[]; coaches: Coach[]; calendar: CalendarEvent[] } {
  // Step 1 — Initialise RNG from config.seed.
  // Seeding here ensures reproducibility: given the same config.seed,
  // every nation, city, and gym is generated identically.
  const rng = createRng(config.seed)

  // Resolve partial difficulty modifiers to full values before any generation runs.
  const modifiers = resolveModifiers(config.difficultyModifiers)

  const allFighters: Fighter[] = []
  const allGyms: Gym[] = []
  const allCoaches: Coach[] = []
  const nations: Record<string, NationState> = {}
  const cities: Record<string, CityState> = {}
  const gymsById: Record<string, Gym> = {}

  let playerGymId = ''

  // Step 2 — For each rendered nation, process its cities.
  for (const nationId of config.renderedNations) {
    const bundle = data.nations[nationId]
    if (bundle === undefined) {
      throw new Error(`Rendered nation "${nationId}" not found in loaded game data`)
    }

    const cityIds: string[] = []

    for (const city of bundle.cities.cities) {
      // Step 3 — Generate gyms for this city.
      const baseGymCount = config.worldSettings.gymsPerCity[city.population] ?? 1
      const rawGymCount  = Math.max(1, Math.round(baseGymCount * city.rivalGymDensity))
      const gymCount     = rawGymCount

      const cityGyms: Gym[] = []
      const usedNamesInCity = new Set<string>()

      for (let g = 0; g < gymCount; g++) {
        const isPlayerGym = city.id === config.playerCityId && g === 0
        const gymName = isPlayerGym ? config.gymName : null

        const { gym } = generateGym(
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

      // Step 4 — Generate fighters directly for each gym using age cohort pyramid.
      // No generic Person pool — every generated entity is a Fighter.
      // Fighter count = floor(lockerCount × talentDensity × 0.30), minimum 1.
      for (const gym of cityGyms) {
        // Determine the template id for casual member calculation.
        // The template id is not stored on gym — derive it from the gym tier or
        // use a safe default. For now, use fitness ratio based on lockerCount range.
        // The gym's templateId would need to be stored to look this up exactly;
        // approximate using lockerCount thresholds matching template ranges.
        const templateId = deriveTemplateId(gym.lockerCount)
        const casualMultiplier = CASUAL_MEMBER_MULTIPLIERS[templateId] ?? 0.50
        const jitter = rng.next() * 0.4 - 0.2  // ±20%
        gym.casualMemberCount = Math.max(
          1,
          Math.round(gym.lockerCount * casualMultiplier * (1 + jitter)),
        )

        const rawFighterCount = gym.lockerCount * modifiers.talentDensity * 0.30
        const fighterCount = Math.max(1, Math.floor(rawFighterCount))

        // Distribute fighter count across cohorts proportionally.
        // Use Math.round for each cohort; adjust the last to hit the total exactly.
        const cohortCounts: number[] = AGE_COHORTS.map(c => Math.round(fighterCount * c.fraction))
        const cohortSum = cohortCounts.reduce((s, n) => s + n, 0)
        const diff = fighterCount - cohortSum
        // Adjust last non-zero cohort to correct rounding drift
        if (diff !== 0) {
          for (let i = cohortCounts.length - 1; i >= 0; i--) {
            if (cohortCounts[i]! + diff >= 0) {
              cohortCounts[i]! += diff
              break
            }
          }
        }

        for (let ci = 0; ci < AGE_COHORTS.length; ci++) {
          const cohort = AGE_COHORTS[ci]!
          const count = cohortCounts[ci] ?? 0

          for (let fi = 0; fi < count; fi++) {
            const age = rng.nextInt(cohort.minAge, cohort.maxAge)
            const person = generatePerson(data, rng, nationId, city.id, age)
            const forcedState = identityStateForCohort(ci, rng)
            const fighter = generateFighter(person, gym.id, null, data, rng, {
              forceIdentityState: forcedState,
            })
            gym.fighterIds.push(fighter.id)
            allFighters.push(fighter)
          }
        }
      }

      // Step 5 — Generate veteran career histories for fighters aged 29+.
      // Applied after all fighters are in memory so veteran attributes can be calibrated
      // relative to the pool. Veterans who are 'competing' or 'retired' need plausible records.
      for (const gym of cityGyms) {
        const gymFighters = allFighters.filter(f => gym.fighterIds.includes(f.id))
        for (const fighter of gymFighters) {
          if (
            fighter.age >= 29 &&
            (fighter.fighterIdentity.state === 'competing' || fighter.fighterIdentity.state === 'retired')
          ) {
            generateVeteranCareer(fighter, data, rng)
          }
        }
      }

      // Step 6 — Assign head coaches from retired fighters.
      for (const gym of cityGyms) {
        const gymFighters = allFighters
          .filter(f => gym.fighterIds.includes(f.id))
          .map(f => ({ fighter: f, person: f as unknown as Person }))

        const coach = assignGymHeadCoach(gym, nationId, gymFighters, data, rng, config.startYear)
        if (coach !== null) {
          allCoaches.push(coach)
        }
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
    rotationIndices: {},
  }

  const calendar = generateCalendar(
    config.startYear,
    1,
    config,
    data,
    rng,
    worldState,
  )

  // persons is kept in the return signature for API compatibility but is now always
  // empty — all entities are Fighters. Callers should use fighters directly.
  return { worldState, persons: [], fighters: allFighters, gyms: allGyms, coaches: allCoaches, calendar }
}

// deriveTemplateId approximates a gym template id from lockerCount.
// The gym doesn't store its template id — we use lockerCount thresholds that
// match the generation ranges in gym-starting-states.json.
function deriveTemplateId(lockerCount: number): string {
  if (lockerCount >= 20) return 'elite_gym'
  if (lockerCount >= 15) return 'competition_gym'
  if (lockerCount >= 10) return 'established_community'
  return 'rundown_community'
}
