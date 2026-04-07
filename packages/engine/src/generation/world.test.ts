import { describe, it, expect, beforeAll } from 'vitest'
import { loadGameData } from '../data/loader.js'
import { generateWorld } from './world.js'
import type { GameData } from '../data/loader.js'
import type { GameConfig } from '../types/gameConfig.js'

let data: GameData

const normalModifiers = {
  rentModifier: 1.0,
  talentDensity: 1.0,
  rivalGymDensity: 1.0,
  giftProbabilityMultiplier: 1.0,
  flawProbabilityMultiplier: 1.0,
  economicStatusWeightShift: 1.0,
  developmentProfileShift: 1.0,
}

const baseConfig: GameConfig = {
  seed: 42,
  startYear: 2026,
  playerName: 'Test Player',
  gymName: 'Test Gym',
  playerCityId: 'latvia-riga',
  playerNationId: 'latvia',
  renderedNations: ['latvia'],
  difficulty: 'normal',
  difficultyModifiers: normalModifiers,
  leagues: { amateur: true, pro: true },
  worldSettings: {
    populationPerCity: 10,
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
    // Worlds should differ — same seed must not be required for any valid world
    expect(a.worldState.seed).not.toBe(b.worldState.seed)
    // At least one person id should differ
    const aIds = new Set(a.persons.map(p => p.id))
    const bIds = b.persons.map(p => p.id)
    const allMatch = bIds.every(id => aIds.has(id))
    expect(allMatch).toBe(false)
  })
})

describe('generateWorld — person count', () => {
  it('generates populationPerCity persons per city', () => {
    const { worldState, persons } = generateWorld(baseConfig, data)
    const latviaBundle = data.nations['latvia']
    expect(latviaBundle).toBeDefined()
    const cityCount = latviaBundle!.cities.cities.length
    // Each city generates populationPerCity * talentDensity people (rounded)
    expect(persons.length).toBe(cityCount * 10)
    // WorldState has all nations
    expect(Object.keys(worldState.nations)).toContain('latvia')
  })

  it('scales person count by talentDensity multiplier', () => {
    const hardConfig: GameConfig = {
      ...baseConfig,
      difficulty: 'hard',
      difficultyModifiers: { ...normalModifiers, talentDensity: 0.5 },
    }
    const normal = generateWorld(baseConfig, data)
    const hard = generateWorld(hardConfig, data)
    // Hard difficulty with 0.5 talentDensity should produce ~half the persons
    expect(hard.persons.length).toBeLessThan(normal.persons.length)
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
    const badConfig: GameConfig = {
      ...baseConfig,
      playerCityId: 'nonexistent-city',
    }
    expect(() => generateWorld(badConfig, data)).toThrow()
  })

  it('throws when renderedNation is not in loaded data', () => {
    const badConfig: GameConfig = {
      ...baseConfig,
      renderedNations: ['nonexistent-nation'],
    }
    expect(() => generateWorld(badConfig, data)).toThrow()
  })
})
