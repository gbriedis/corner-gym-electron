import { describe, it, expect, beforeAll } from 'vitest'
import { loadGameData } from '../data/loader.js'
import { generateCalendar } from './calendar.js'
import { createRng } from '../utils/rng.js'
import type { GameData } from '../data/loader.js'
import type { GameConfig } from '../types/gameConfig.js'
import type { WorldState } from '../types/worldState.js'

let data: GameData

const baseConfig: GameConfig = {
  seed: 42,
  startYear: 2026,
  playerName: 'Test Player',
  gymName: 'Test Gym',
  playerCityId: 'latvia-riga',
  playerNationId: 'latvia',
  renderedNations: ['latvia'],
  difficulty: 'normal',
  difficultyModifiers: {},
  leagues: { amateur: true, pro: true },
  worldSettings: {
    populationPerCity: { small_town: 10, mid_city: 10, capital: 10 },
    gymsPerCity: { small_town: 1, mid_city: 2, capital: 3 },
  },
}

function makeWorldState(overrides: Partial<WorldState> = {}): WorldState {
  return {
    saveId: '',
    seed: 42,
    currentYear: 2026,
    currentWeek: 1,
    playerName: 'Test',
    gymName: 'Test Gym',
    playerGymId: 'latvia-riga-gym-0',
    playerCityId: 'latvia-riga',
    playerNationId: 'latvia',
    nations: {},
    cities: {},
    gyms: {},
    rotationIndices: {},
    ...overrides,
  }
}

beforeAll(() => {
  data = loadGameData()
})

describe('generateCalendar — national championship timing', () => {
  it('national championship always lands in November (weeks 44-48)', () => {
    const ws = makeWorldState()
    const rng = createRng(42)
    const events = generateCalendar(2026, 1, baseConfig, data, rng, ws)
    const nationals = events.filter(e => e.circuitLevel === 'national_championship')
    expect(nationals.length).toBeGreaterThan(0)
    for (const e of nationals) {
      expect(e.week).toBeGreaterThanOrEqual(44)
      expect(e.week).toBeLessThanOrEqual(48)
    }
  })

  it('national championship appears for both generated years', () => {
    const ws = makeWorldState()
    const rng = createRng(42)
    const events = generateCalendar(2026, 1, baseConfig, data, rng, ws)
    const nationals = events.filter(e => e.circuitLevel === 'national_championship')
    const years = new Set(nationals.map(e => e.year))
    expect(years.has(2026)).toBe(true)
    expect(years.has(2027)).toBe(true)
  })
})

describe('generateCalendar — Olympic year gating', () => {
  it('Olympics only generated in 2028, not in 2026 or 2027', () => {
    const ws = makeWorldState()
    const rng = createRng(42)
    const events = generateCalendar(2026, 1, baseConfig, data, rng, ws)
    const olympics = events.filter(e => e.circuitLevel === 'olympics')
    // 2028 is outside our 2026+2027 window — no olympic events expected
    expect(olympics.length).toBe(0)
  })

  it('Olympics generated when start year is 2028', () => {
    const ws = makeWorldState({ currentYear: 2028 })
    const rng = createRng(42)
    const config2028: GameConfig = { ...baseConfig, startYear: 2028 }
    const events = generateCalendar(2028, 1, config2028, data, rng, ws)
    const olympics = events.filter(e => e.circuitLevel === 'olympics')
    expect(olympics.length).toBeGreaterThan(0)
  })
})

describe('generateCalendar — major event week collision', () => {
  it('no two national_championship+ events share the same year+week', () => {
    const ws = makeWorldState()
    const rng = createRng(42)
    const events = generateCalendar(2026, 1, baseConfig, data, rng, ws)
    const majors = events.filter(e =>
      ['national_championship', 'baltic_championship', 'european_championship',
       'world_championship', 'olympics'].includes(e.circuitLevel),
    )
    const seen = new Set<string>()
    for (const e of majors) {
      const key = `${e.year}-${e.week}`
      expect(seen.has(key), `Collision at ${key} for ${e.circuitLevel}`).toBe(false)
      seen.add(key)
    }
  })
})

describe('generateCalendar — determinism', () => {
  it('same seed + config produces identical calendar', () => {
    const ws1 = makeWorldState()
    const ws2 = makeWorldState()
    const a = generateCalendar(2026, 1, baseConfig, data, createRng(42), ws1)
    const b = generateCalendar(2026, 1, baseConfig, data, createRng(42), ws2)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('different seed produces different calendar', () => {
    const ws1 = makeWorldState()
    const ws2 = makeWorldState()
    const a = generateCalendar(2026, 1, baseConfig, data, createRng(42), ws1)
    const b = generateCalendar(2026, 1, baseConfig, data, createRng(99), ws2)
    // At least some event weeks should differ
    const aWeeks = a.map(e => e.week)
    const bWeeks = b.map(e => e.week)
    expect(aWeeks.join()).not.toBe(bWeeks.join())
  })
})

describe('generateCalendar — host city rotation', () => {
  it('host city rotation increments correctly across two generated years', () => {
    const ws = makeWorldState()
    const rng = createRng(42)
    generateCalendar(2026, 1, baseConfig, data, rng, ws)
    // After generation, rotationIndices should have advanced for the national championship
    const rotKey = 'national_championship_annual'
    // Two years generated → index should have advanced by 2
    expect(ws.rotationIndices[rotKey]).toBe(2)
  })

  it('rotation wraps back to 0 after exhausting the city list', () => {
    // Latvia has 5 cities in rotation — after 5 events the index wraps to 0
    const ws = makeWorldState({ rotationIndices: { national_championship_annual: 4 } })
    const rng = createRng(42)
    generateCalendar(2026, 1, baseConfig, data, rng, ws)
    // Started at 4 (last city), two events generated → wraps: 5→0, then 0→1
    expect(ws.rotationIndices['national_championship_annual']).toBe(1)
  })
})

describe('generateCalendar — venue eligibility', () => {
  it('every event has a venueId that exists in the venue data', () => {
    const ws = makeWorldState()
    const rng = createRng(42)
    const events = generateCalendar(2026, 1, baseConfig, data, rng, ws)
    // Collect all known venue ids
    const allVenueIds = new Set<string>()
    for (const bundle of Object.values(data.nations)) {
      if (bundle.boxing !== undefined) {
        for (const v of bundle.boxing.venues.venues) allVenueIds.add(v.id)
      }
    }
    for (const v of data.international.boxing.venues.venues) allVenueIds.add(v.id)

    for (const event of events) {
      expect(allVenueIds.has(event.venueId), `Unknown venueId "${event.venueId}" on event ${event.id}`).toBe(true)
    }
  })
})

describe('generateCalendar — year window', () => {
  it('mid-year start (week 26) still generates remainder of start year + full next year', () => {
    const ws = makeWorldState()
    const rng = createRng(42)
    const events = generateCalendar(2026, 26, baseConfig, data, rng, ws)
    const years = new Set(events.map(e => e.year))
    expect(years.has(2026)).toBe(true)
    expect(years.has(2027)).toBe(true)
  })

  it('no events are placed before startWeek in the start year', () => {
    const ws = makeWorldState()
    const rng = createRng(42)
    const startWeek = 30
    const events = generateCalendar(2026, startWeek, baseConfig, data, rng, ws)
    const startYearEvents = events.filter(e => e.year === 2026)
    for (const e of startYearEvents) {
      expect(e.week).toBeGreaterThanOrEqual(startWeek)
    }
  })
})
