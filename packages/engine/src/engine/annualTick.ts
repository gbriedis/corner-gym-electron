// runAnnualPipeline seeds new young fighters into each city once per year.
// Called at the year rollover (week 52 → week 1).
//
// Two signals determine how many fighters to seed:
//   1. Base rate by city population type — larger cities have more boxing talent entering
//   2. Retirement replacement — 80% of fighters who retired this year are replaced
//
// Seeded fighters are aged 13-16 with 'unaware' identity state. They represent
// teenagers encountering boxing for the first time — they are not yet committed.
// Most will never reach 'competing', but the ones that do feed the pipeline over time.

import { generatePerson } from '../generation/person.js'
import { generateFighter } from '../generation/fighter.js'

import type { AdvanceWeekState } from '../types/advanceWeek.js'
import type { GameData } from '../data/loader.js'
import type { RNG } from '../utils/rng.js'

// BASE_ANNUAL_SEED maps city population type to how many new young fighters enter
// the system each year. Larger cities have deeper talent pools.
// Calibrated for a 10-year backrun producing 150-220 total fighters across a
// typical nation (1 capital, 2-3 large cities, 4-6 mid/small cities).
// The pipeline supplements world-gen fighters; seeding too aggressively inflates
// the pool beyond what the competition calendar can absorb.
const BASE_ANNUAL_SEED: Record<string, number> = {
  capital:    2,
  large_city: 2,
  mid_city:   1,
  small_town: 1,
}

// findGymWithCapacity picks a gym in the city that has room for another fighter.
// Capacity = gym.lockerCount − gym.fighterIds.length. Returns null if all gyms are full.
function findGymWithCapacity(cityId: string, state: AdvanceWeekState, rng: RNG): string | null {
  const cityState = state.worldState.cities[cityId]
  if (cityState === undefined) return null

  const available = cityState.gymIds.filter(gymId => {
    const gym = state.gyms.get(gymId)
    return gym !== undefined && gym.fighterIds.length < gym.lockerCount
  })

  if (available.length === 0) return null
  return rng.pick(available)
}

export function runAnnualPipeline(state: AdvanceWeekState, data: GameData, rng: RNG): void {
  for (const [nationId, nation] of Object.entries(state.worldState.nations)) {
    for (const cityId of nation.cityIds) {
      const cityState = state.worldState.cities[cityId]
      if (cityState === undefined) continue

      // Look up city data for population type and talentDensity.
      const nationBundle = data.nations[nationId]
      const cityData = nationBundle?.cities.cities.find(c => c.id === cityId)
      if (cityData === undefined) continue

      const baseSeed = BASE_ANNUAL_SEED[cityData.population] ?? 2
      const retiredThisYear = state.annualRetirementCount[cityId] ?? 0

      // Seed at least baseSeed × talentDensity, but replace 80% of retirements if that's more.
      // The jitter (±20%) prevents every city from seeding the exact same count each year.
      const jitter = rng.next() * 0.4 + 0.8  // 0.8-1.2
      const baseCount = Math.round(baseSeed * cityData.talentDensity * jitter)
      const replacementCount = Math.round(retiredThisYear * 0.8)
      const newCount = Math.max(baseCount, replacementCount)

      for (let i = 0; i < newCount; i++) {
        const gymId = findGymWithCapacity(cityId, state, rng)
        if (gymId === null) continue

        const age = rng.nextInt(13, 16)
        const basePerson = generatePerson(data, rng, nationId, cityId, age)
        // Prefix pipeline IDs with "p-" to guarantee no collision with world gen IDs.
        // generatePerson's seeded RNG IDs could theoretically match world gen IDs
        // when the backrun RNG hits the same state — the prefix makes that impossible.
        const person = { ...basePerson, id: `p-${basePerson.id}` }
        const fighter = generateFighter(person, gymId, null, data, rng, {
          forceIdentityState: 'unaware',
        })

        state.fighters.set(fighter.id, fighter)

        const gym = state.gyms.get(gymId)
        if (gym !== undefined) {
          gym.fighterIds.push(fighter.id)
          state.pendingGymUpdates.add(gymId)
        }

        // New fighters need INSERT, not UPDATE — track separately so the DB layer
        // can distinguish between existing fighters to update and new ones to insert.
        state.pendingNewFighterIds.add(fighter.id)
      }
    }
  }

  // Reset annual retirement counter for the new year.
  state.annualRetirementCount = {}
}
