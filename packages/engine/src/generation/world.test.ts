import { describe, it, expect, beforeAll } from 'vitest'
import { loadGameData } from '../data/loader.js'
import { generateWorld } from './world.js'
import type { GameData } from '../data/loader.js'
import type { GameConfig } from '../types/gameConfig.js'

let data: GameData

// All tiers set to the same value so person-count assertions stay simple.
// Production config uses different values per tier — that's tested separately.
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
    expect(a.persons.length).toBe(b.persons.length)
    expect(a.persons[0].id).toBe(b.persons[0].id)
  })

  it('produces a different world for a different seed', () => {
    const a = generateWorld(baseConfig, data)
    const b = generateWorld({ ...baseConfig, seed: 99 }, data)
    expect(a.worldState.seed).not.toBe(b.worldState.seed)
    const aIds = new Set(a.persons.map(p => p.id))
    const bIds = b.persons.map(p => p.id)
    const allMatch = bIds.every(id => aIds.has(id))
    expect(allMatch).toBe(false)
  })
})

describe('generateWorld — person count', () => {
  it('generates populationPerCity persons per city (flat-pop config)', () => {
    const { worldState, persons } = generateWorld(baseConfig, data)
    const latviaBundle = data.nations['latvia']
    expect(latviaBundle).toBeDefined()
    const cityCount = latviaBundle!.cities.cities.length
    // All tiers set to FLAT_POP so total = cityCount * FLAT_POP
    expect(persons.length).toBe(cityCount * FLAT_POP)
    expect(Object.keys(worldState.nations)).toContain('latvia')
  })

  it('capitals produce more persons than small towns with tier-based config', () => {
    const tieredConfig: GameConfig = {
      ...baseConfig,
      worldSettings: {
        populationPerCity: { small_town: 5, mid_city: 20, capital: 100 },
        gymsPerCity: { small_town: 1, mid_city: 3, capital: 6 },
      },
    }
    const flat = generateWorld(baseConfig, data)
    const tiered = generateWorld(tieredConfig, data)
    // Tiered should differ in person count (capital contributes 100 vs 10)
    expect(tiered.persons.length).not.toBe(flat.persons.length)
  })

  it('scales person count by talentDensity multiplier', () => {
    const hardConfig: GameConfig = {
      ...baseConfig,
      difficulty: 'hard',
      difficultyModifiers: { talentDensity: 0.5 },
    }
    const normal = generateWorld(baseConfig, data)
    const hard = generateWorld(hardConfig, data)
    expect(hard.persons.length).toBeLessThan(normal.persons.length)
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
    expect(fromEmpty.persons.length).toBe(fromExplicit.persons.length)
    expect(JSON.stringify(fromEmpty.worldState.gyms)).toBe(JSON.stringify(fromExplicit.worldState.gyms))
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
})

describe('generateWorld — world structure', () => {
  it('every gym personId references a real person', () => {
    const { worldState, persons } = generateWorld(baseConfig, data)
    const personIds = new Set(persons.map(p => p.id))
    for (const gym of Object.values(worldState.gyms)) {
      for (const pid of gym.personIds) {
        expect(personIds.has(pid)).toBe(true)
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
