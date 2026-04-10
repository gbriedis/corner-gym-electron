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
  it('every gym memberIds references a real person', () => {
    const { worldState, persons } = generateWorld(baseConfig, data)
    const personIds = new Set(persons.map(p => p.id))
    for (const gym of Object.values(worldState.gyms)) {
      for (const pid of gym.memberIds) {
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

describe('generateWorld — gym generation', () => {
  it('generates correct number of gyms per city based on gymsPerCity × rivalGymDensity', () => {
    const { worldState, persons } = generateWorld(baseConfig, data)
    const latviaBundle = data.nations['latvia']!
    // Build person count per city to reproduce the cap logic from world.ts
    const personCountByCity: Record<string, number> = {}
    for (const city of latviaBundle.cities.cities) {
      const baseCount = baseConfig.worldSettings.populationPerCity[city.population] ?? 150
      personCountByCity[city.id] = Math.max(1, Math.round(baseCount))
    }
    for (const city of latviaBundle.cities.cities) {
      const cityState = worldState.cities[city.id]
      expect(cityState).toBeDefined()
      const baseCount  = baseConfig.worldSettings.gymsPerCity[city.population] ?? 1
      const rawCount   = Math.max(1, Math.round(baseCount * city.rivalGymDensity))
      const expected   = Math.min(rawCount, personCountByCity[city.id] ?? 1)
      expect(cityState!.gymIds.length).toBe(expected)
    }
  })

  it('every gym has at least one member', () => {
    const { worldState } = generateWorld(baseConfig, data)
    for (const gym of Object.values(worldState.gyms)) {
      expect(gym.memberIds.length).toBeGreaterThan(0)
    }
  })

  it('total persons = gym members + free agents (no person lost)', () => {
    const { worldState, persons } = generateWorld(baseConfig, data)
    const gymMemberIds = new Set<string>()
    for (const gym of Object.values(worldState.gyms)) {
      for (const id of gym.memberIds) gymMemberIds.add(id)
    }
    const freeAgents = persons.filter(p => !gymMemberIds.has(p.id))
    expect(gymMemberIds.size + freeAgents.length).toBe(persons.length)
  })

  it('free agents exist when gym capacity is exceeded', () => {
    // 200 persons per city with 1 small gym (lockerCount ~10-25) → many free agents
    const highPopConfig: GameConfig = {
      ...baseConfig,
      worldSettings: {
        populationPerCity: { small_town: 200, mid_city: 200, capital: 200 },
        gymsPerCity: { small_town: 1, mid_city: 1, capital: 1 },
      },
    }
    const { worldState, persons } = generateWorld(highPopConfig, data)
    const gymMemberIds = new Set<string>()
    for (const gym of Object.values(worldState.gyms)) {
      for (const id of gym.memberIds) gymMemberIds.add(id)
    }
    const freeAgentCount = persons.length - gymMemberIds.size
    expect(freeAgentCount).toBeGreaterThan(0)
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

  it('every fighterIds entry in a gym also appears in memberIds', () => {
    const { worldState } = generateWorld(baseConfig, data)
    for (const gym of Object.values(worldState.gyms)) {
      const memberSet = new Set(gym.memberIds)
      for (const fid of gym.fighterIds) {
        expect(memberSet.has(fid)).toBe(true)
      }
    }
  })
})
