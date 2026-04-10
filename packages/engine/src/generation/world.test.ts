import { describe, it, expect, beforeAll } from 'vitest'
import { loadGameData } from '../data/loader.js'
import { generateWorld } from './world.js'
import type { GameData } from '../data/loader.js'
import type { GameConfig } from '../types/gameConfig.js'

let data: GameData

// populationPerCity is still in GameConfig but no longer drives fighter count.
// Fighter count is determined by gym.lockerCount × talentDensity × 0.30.
const FLAT_POP = 10

const baseConfig: GameConfig = {
  seed: 42,
  startYear: 2026,
  playerName: 'Test Player',
  gymName: 'Test Gym',
  playerCityId: 'latvia-riga',
  playerNationId: 'latvia',
  renderedNations: ['latvia'],
  difficulty: 'normal',
  difficultyModifiers: {}, // empty — resolveModifiers fills 1.0 for every field
  leagues: { amateur: true, pro: true },
  worldSettings: {
    populationPerCity: { small_town: FLAT_POP, mid_city: FLAT_POP, capital: FLAT_POP },
    gymsPerCity: { small_town: 1, mid_city: 3, capital: 6 },
  },
}

beforeAll(() => {
  data = loadGameData()
})

describe('generateWorld — determinism', () => {
  it('produces the same world for the same seed and config', () => {
    const a = generateWorld(baseConfig, data)
    const b = generateWorld(baseConfig, data)
    expect(JSON.stringify(a.worldState)).toBe(JSON.stringify(b.worldState))
    expect(a.fighters.length).toBe(b.fighters.length)
    expect(a.fighters[0]!.id).toBe(b.fighters[0]!.id)
  })

  it('produces a different world for a different seed', () => {
    const a = generateWorld(baseConfig, data)
    const b = generateWorld({ ...baseConfig, seed: 99 }, data)
    expect(a.worldState.seed).not.toBe(b.worldState.seed)
    const aIds = new Set(a.fighters.map(f => f.id))
    const bIds = b.fighters.map(f => f.id)
    const allMatch = bIds.every(id => aIds.has(id))
    expect(allMatch).toBe(false)
  })
})

describe('generateWorld — fighter count', () => {
  it('produces fighters for every rendered nation', () => {
    const { fighters, worldState } = generateWorld(baseConfig, data)
    expect(fighters.length).toBeGreaterThan(0)
    expect(Object.keys(worldState.nations)).toContain('latvia')
  })

  it('scales fighter count by talentDensity multiplier', () => {
    const hardConfig: GameConfig = {
      ...baseConfig,
      difficulty: 'hard',
      difficultyModifiers: { talentDensity: 0.5 },
    }
    const normal = generateWorld(baseConfig, data)
    const hard = generateWorld(hardConfig, data)
    // Lower talentDensity → fewer fighters per gym
    expect(hard.fighters.length).toBeLessThan(normal.fighters.length)
  })

  it('normal difficulty with empty modifiers produces same result as all-1.0 modifiers', () => {
    const explicitConfig: GameConfig = {
      ...baseConfig,
      difficultyModifiers: {
        rentModifier: 1.0,
        talentDensity: 1.0,
        rivalGymDensity: 1.0,
        giftProbabilityMultiplier: 1.0,
        flawProbabilityMultiplier: 1.0,
        economicStatusWeightShift: 1.0,
        developmentProfileShift: 1.0,
      },
    }
    const fromEmpty = generateWorld(baseConfig, data)
    const fromExplicit = generateWorld(explicitConfig, data)
    expect(fromEmpty.fighters.length).toBe(fromExplicit.fighters.length)
    // Compare gym structure — same seed + config must produce same gyms
    const emptyGymIds = Object.keys(fromEmpty.worldState.gyms).sort()
    const explicitGymIds = Object.keys(fromExplicit.worldState.gyms).sort()
    expect(emptyGymIds).toEqual(explicitGymIds)
  })
})

describe('generateWorld — player gym', () => {
  it('marks exactly one gym as the player gym', () => {
    const { worldState } = generateWorld(baseConfig, data)
    const playerGyms = Object.values(worldState.gyms).filter(g => g.isPlayerGym)
    expect(playerGyms.length).toBe(1)
  })

  it('player gym is in the correct city', () => {
    const { worldState } = generateWorld(baseConfig, data)
    const playerGym = worldState.gyms[worldState.playerGymId]
    expect(playerGym).toBeDefined()
    expect(playerGym!.cityId).toBe('latvia-riga')
  })

  it('player gym has the config gym name', () => {
    const { worldState } = generateWorld(baseConfig, data)
    const playerGym = worldState.gyms[worldState.playerGymId]
    expect(playerGym!.name).toBe('Test Gym')
  })

  it('playerGymId matches the player gym entry', () => {
    const { worldState } = generateWorld(baseConfig, data)
    const gym = worldState.gyms[worldState.playerGymId]
    expect(gym).toBeDefined()
    expect(gym!.isPlayerGym).toBe(true)
  })

  it('player city has exactly one player gym', () => {
    const { worldState } = generateWorld(baseConfig, data)
    const playerCityGymIds = worldState.cities['latvia-riga']?.gymIds ?? []
    const playerGymsInCity = playerCityGymIds.filter(
      id => worldState.gyms[id]?.isPlayerGym === true,
    )
    expect(playerGymsInCity.length).toBe(1)
  })

  it('all other gyms have isPlayerGym false', () => {
    const { worldState } = generateWorld(baseConfig, data)
    const rivalGyms = Object.values(worldState.gyms).filter(g => !g.isPlayerGym)
    for (const gym of rivalGyms) {
      expect(gym.isPlayerGym).toBe(false)
    }
  })
})

describe('generateWorld — world structure', () => {
  it('every gym fighterIds references a real fighter', () => {
    const { worldState, fighters } = generateWorld(baseConfig, data)
    const fighterIds = new Set(fighters.map(f => f.id))
    for (const gym of Object.values(worldState.gyms)) {
      for (const fid of gym.fighterIds) {
        expect(fighterIds.has(fid)).toBe(true)
      }
    }
  })

  it('every city in world state has at least one gym', () => {
    const { worldState } = generateWorld(baseConfig, data)
    for (const city of Object.values(worldState.cities)) {
      expect(city.gymIds.length).toBeGreaterThan(0)
    }
  })

  it('worldState seed matches config seed', () => {
    const { worldState } = generateWorld(baseConfig, data)
    expect(worldState.seed).toBe(42)
  })

  it('worldState currentYear matches config startYear', () => {
    const { worldState } = generateWorld(baseConfig, data)
    expect(worldState.currentYear).toBe(2026)
    expect(worldState.currentWeek).toBe(1)
  })

  it('throws when playerCityId is not in any rendered nation', () => {
    const badConfig: GameConfig = { ...baseConfig, playerCityId: 'nonexistent-city' }
    expect(() => generateWorld(badConfig, data)).toThrow()
  })

  it('throws when renderedNation is not in loaded data', () => {
    const badConfig: GameConfig = { ...baseConfig, renderedNations: ['nonexistent-nation'] }
    expect(() => generateWorld(badConfig, data)).toThrow()
  })
})

describe('generateWorld — gym generation', () => {
  it('generates correct number of gyms per city based on gymsPerCity × rivalGymDensity', () => {
    const { worldState } = generateWorld(baseConfig, data)
    const latviaBundle = data.nations['latvia']!
    for (const city of latviaBundle.cities.cities) {
      const cityState = worldState.cities[city.id]
      expect(cityState).toBeDefined()
      const baseCount = baseConfig.worldSettings.gymsPerCity[city.population] ?? 1
      const expected  = Math.max(1, Math.round(baseCount * city.rivalGymDensity))
      expect(cityState!.gymIds.length).toBe(expected)
    }
  })

  it('every gym has at least one fighter', () => {
    const { worldState } = generateWorld(baseConfig, data)
    for (const gym of Object.values(worldState.gyms)) {
      expect(gym.fighterIds.length).toBeGreaterThan(0)
    }
  })

  it('every gym has a positive casualMemberCount', () => {
    const { worldState } = generateWorld(baseConfig, data)
    for (const gym of Object.values(worldState.gyms)) {
      expect(gym.casualMemberCount).toBeGreaterThan(0)
    }
  })

  it('gym has a full quality object with all required fields', () => {
    const { worldState } = generateWorld(baseConfig, data)
    const gym = Object.values(worldState.gyms)[0]!
    expect(typeof gym.quality.overall).toBe('number')
    expect(typeof gym.quality.hasRing).toBe('boolean')
    expect(typeof gym.quality.maxTrainingCapacity).toBe('number')
  })

  it('return value includes gyms flat array matching worldState.gyms', () => {
    const { worldState, gyms } = generateWorld(baseConfig, data)
    expect(gyms.length).toBe(Object.keys(worldState.gyms).length)
    for (const gym of gyms) {
      expect(worldState.gyms[gym.id]).toBeDefined()
    }
  })
})

describe('generateWorld — fighters', () => {
  it('fighters array is populated', () => {
    const { fighters } = generateWorld(baseConfig, data)
    expect(fighters.length).toBeGreaterThan(0)
  })

  it('every fighter id appears in their gym fighterIds', () => {
    const { worldState, fighters } = generateWorld(baseConfig, data)
    const allFighterIds = new Set<string>()
    for (const gym of Object.values(worldState.gyms)) {
      for (const id of gym.fighterIds) allFighterIds.add(id)
    }
    for (const fighter of fighters) {
      expect(allFighterIds.has(fighter.id)).toBe(true)
    }
  })

  it('fighters span multiple age cohorts (13-40 range populated)', () => {
    const { fighters } = generateWorld(baseConfig, data)
    const hasYoung = fighters.some(f => f.age >= 13 && f.age <= 22)
    const hasMid   = fighters.some(f => f.age >= 23 && f.age <= 28)
    const hasOld   = fighters.some(f => f.age >= 29 && f.age <= 40)
    expect(hasYoung).toBe(true)
    expect(hasMid).toBe(true)
    expect(hasOld).toBe(true)
  })
})
