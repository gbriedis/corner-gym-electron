// generateWorld produces a complete WorldState from a GameConfig.
//
// Generation order:
// 1. Initialise RNG from config.seed — all randomness flows through this single
//    seeded RNG so the same seed + config always produces the same world.
// 2. For each rendered nation — collect its cities from the loaded game data.
// 3. For each city — generate the population. Population count is scaled by
//    the talentDensity difficulty modifier; a harder game produces fewer people
//    to recruit from. City population is rounded up so every city has at least 1.
// 4. For each city — generate gyms and distribute the population across them.
//    The gym count comes from worldSettings.gymsPerCity keyed by population type.
//    Population is distributed round-robin across gyms so no gym starts empty.
// 5. The player gym is identified by config.playerCityId — one gym in that city
//    is marked isPlayerGym and named from config.gymName. Player gym is always
//    the first gym generated in the player city so the position is deterministic.
// 6. Return the complete WorldState plus the flat Person[] array.

import { createRng } from '../utils/rng.js'
import { generatePerson } from './person.js'

import type { GameData } from '../data/loader.js'
import type { GameConfig } from '../types/gameConfig.js'
import type { WorldState, NationState, CityState, GymState } from '../types/worldState.js'
import type { Person } from '../types/person.js'

// Non-player gym name templates — deterministic pick via RNG, not hardcoded data,
// because gym names are presentation layer and not simulation-critical values.
// A future gym-names data file can replace this list without engine changes.
const GYM_NAME_TEMPLATES = [
  'Boxing Club',
  'Fight Academy',
  'Combat Sports',
  'Boxing Gym',
  'Athletic Club',
  'Training Centre',
]

export function generateWorld(
  config: GameConfig,
  data: GameData,
): { worldState: WorldState; persons: Person[] } {
  // Step 1 — Initialise RNG from config.seed.
  // Seeding here ensures reproducibility: given the same config.seed,
  // every nation, city, person, and gym is generated identically.
  const rng = createRng(config.seed)

  const allPersons: Person[] = []
  const nations: Record<string, NationState> = {}
  const cities: Record<string, CityState> = {}
  const gyms: Record<string, GymState> = {}

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

    // Step 3 — For each city, generate population scaled by difficulty talentDensity.
    // talentDensity < 1.0 (hard/extreme) reduces how many fighters exist in the world,
    // making recruitment harder. We round up to ensure every city has at least one person.
    for (const city of bundle.cities.cities) {
      const rawCount = config.worldSettings.populationPerCity * config.difficultyModifiers.talentDensity
      const personCount = Math.max(1, Math.round(rawCount))

      const cityPersons: Person[] = []
      for (let i = 0; i < personCount; i++) {
        cityPersons.push(generatePerson(data, rng, nationId, city.id))
      }
      allPersons.push(...cityPersons)

      // Step 4 — Generate gyms and distribute population across them.
      // Gym count is keyed by the city's population type (small_town, mid_city, capital).
      // Defaulting to 1 ensures even unsupported population types always produce a gym.
      const gymCount = config.worldSettings.gymsPerCity[city.population] ?? 1
      const gymIds: string[] = []

      for (let g = 0; g < gymCount; g++) {
        const gymId = `${city.id}-gym-${g}`

        // Step 5 — Mark the player gym. The first gym in the player's city is the player gym.
        // Using index 0 makes this deterministic — the player always starts in the same gym slot
        // regardless of other config changes. Name and reputation come from config.
        const isPlayerGym = city.id === config.playerCityId && g === 0

        if (isPlayerGym) {
          playerGymId = gymId
        }

        const gymName = isPlayerGym
          ? config.gymName
          : `${city.label} ${rng.pick(GYM_NAME_TEMPLATES)}`

        // Distribute persons round-robin across gyms so each starts with roughly equal members.
        // Round-robin is simpler than weighted distribution and prevents any gym starting empty.
        const gymPersonIds: string[] = []
        for (let i = g; i < cityPersons.length; i += gymCount) {
          gymPersonIds.push(cityPersons[i].id)
        }

        const gym: GymState = {
          id: gymId,
          name: gymName,
          cityId: city.id,
          nationId,
          isPlayerGym,
          reputation: isPlayerGym ? 20 : rng.nextInt(10, 60),
          personIds: gymPersonIds,
        }

        gyms[gymId] = gym
        gymIds.push(gymId)
      }

      cities[city.id] = {
        cityId: city.id,
        nationId,
        gymIds,
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

  // Step 6 — Assemble and return the WorldState.
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
    gyms,
  }

  return { worldState, persons: allPersons }
}
