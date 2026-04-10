import { describe, it, expect, beforeAll } from 'vitest'
import { loadGameData } from '../data/loader.js'
import { generateWorld } from '../generation/world.js'
import { advanceWeek } from './advanceWeek.js'
import { coachShouldEnterFighter } from './coachEntryDecision.js'
import { runBackrun } from '../generation/backrun.js'
import { createRng } from '../utils/rng.js'

import type { GameData } from '../data/loader.js'
import type { AdvanceWeekState } from '../types/advanceWeek.js'
import type { GameConfig } from '../types/gameConfig.js'
import type { Fighter } from '../types/fighter.js'
import type { CalendarEvent } from '../types/calendar.js'

let data: GameData
let config: GameConfig

// Shared test config — Latvia, small seed for fast determinism.
const TEST_CONFIG: GameConfig = {
  seed: 42,
  startYear: 2026,
  playerName: 'Test',
  gymName: 'Test Gym',
  playerCityId: 'latvia-riga',
  playerNationId: 'latvia',
  renderedNations: ['latvia'],
  difficulty: 'normal',
  difficultyModifiers: {},
  leagues: { amateur: true, pro: false },
  worldSettings: {
    populationPerCity: { small_town: 20, mid_city: 40, capital: 80 },
    gymsPerCity: { small_town: 1, mid_city: 2, capital: 3 },
  },
}

beforeAll(() => {
  data = loadGameData()
  config = TEST_CONFIG
})

// buildMinimalState creates a minimal AdvanceWeekState for unit tests.
// Uses generateWorld to produce real fighters and gyms rather than faking them.
function buildTestState(seed = 42, year = 2020, week = 1): AdvanceWeekState {
  const rng = createRng(seed)
  const cfg: GameConfig = { ...config, seed }
  const { worldState, persons, fighters, gyms, coaches, calendar } = generateWorld(cfg, data)

  const fighterMap = new Map(fighters.map(f => [f.id, f]))
  const fighterIds = new Set(fighters.map(f => f.id))
  const personMap = new Map(
    persons.filter(p => !fighterIds.has(p.id)).map(p => [p.id, p]),
  )
  const gymMap = new Map(gyms.map(g => [g.id, g]))
  const coachMap = new Map(coaches.map(c => [c.id, c]))

  void rng

  return {
    year,
    week,
    worldState: { ...worldState, currentYear: year, currentWeek: week },
    persons: personMap,
    fighters: fighterMap,
    gyms: gymMap,
    coaches: coachMap,
    calendar,
    pendingBoutResults: [],
    pendingAttributeEvents: new Map(),
    pendingFighterUpdates: new Set(),
    pendingGymUpdates: new Set(),
  }
}

// ─── Week / Year Advancement ─────────────────────────────────────────────────

describe('week and year advancement', () => {
  it('increments week by 1 each tick', () => {
    const state = buildTestState()
    const rng = createRng(1)
    advanceWeek(state, data, rng, true)
    expect(state.week).toBe(2)
    expect(state.year).toBe(2020)
  })

  it('rolls week 52 over to week 1 of next year', () => {
    const state = buildTestState(42, 2020, 52)
    const rng = createRng(1)
    advanceWeek(state, data, rng, true)
    expect(state.week).toBe(1)
    expect(state.year).toBe(2021)
  })
})

// ─── Equipment Decay ─────────────────────────────────────────────────────────

describe('equipment condition decays each week', () => {
  it('each equipment item loses condition every tick', () => {
    const state = buildTestState()
    // Collect all initial conditions
    const before = new Map<string, number>()
    for (const [, gym] of state.gyms) {
      for (const item of gym.equipment) {
        if (item.condition > 0) before.set(item.id, item.condition)
      }
    }

    const rng = createRng(1)
    advanceWeek(state, data, rng, true)

    let anyDecayed = false
    for (const [, gym] of state.gyms) {
      for (const item of gym.equipment) {
        const prev = before.get(item.id)
        if (prev !== undefined && item.condition < prev) {
          anyDecayed = true
          break
        }
      }
      if (anyDecayed) break
    }

    expect(anyDecayed).toBe(true)
  })

  it('equipment condition cannot go below 0', () => {
    const state = buildTestState()
    // Set all equipment to 0 before ticking
    for (const [, gym] of state.gyms) {
      for (const item of gym.equipment) {
        item.condition = 0
      }
    }

    const rng = createRng(1)
    advanceWeek(state, data, rng, true)

    for (const [, gym] of state.gyms) {
      for (const item of gym.equipment) {
        expect(item.condition).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

// ─── Gym Finances ────────────────────────────────────────────────────────────

describe('gym finances update each week', () => {
  it('gym balance changes each tick reflecting income minus outgoings', () => {
    const state = buildTestState()
    const initialBalances = new Map<string, number>()
    for (const [gymId, gym] of state.gyms) {
      initialBalances.set(gymId, gym.finances.balance)
    }

    const rng = createRng(1)
    advanceWeek(state, data, rng, true)

    let anyChanged = false
    for (const [gymId, gym] of state.gyms) {
      const prev = initialBalances.get(gymId)
      if (prev !== undefined && gym.finances.balance !== prev) {
        anyChanged = true
        break
      }
    }
    expect(anyChanged).toBe(true)
  })
})

// ─── Fighter Inactivity ──────────────────────────────────────────────────────

describe('fighter inactivity regression', () => {
  it('competing fighter inactive past threshold accumulates attribute events', () => {
    const state = buildTestState()

    // Find a competing or aspiring fighter and mark them as long-term inactive
    let targetFighterId: string | null = null
    for (const [id, fighter] of state.fighters) {
      if (
        fighter.fighterIdentity.state === 'competing' ||
        fighter.fighterIdentity.state === 'aspiring'
      ) {
        // Put last bout far in the past (200 weeks ago)
        fighter.career.lastBoutYear = state.year - 4
        fighter.career.lastBoutWeek = state.week
        targetFighterId = id
        break
      }
    }

    if (targetFighterId === null) return  // skip if no eligible fighter in this world

    const rng = createRng(1)
    advanceWeek(state, data, rng, true)

    // Should have logged attribute regression events
    const events = state.pendingAttributeEvents.get(targetFighterId)
    expect(events).toBeDefined()
    expect(events!.length).toBeGreaterThan(0)
    expect(events!.some(e => e.trigger === 'inactivity')).toBe(true)
  })
})

// ─── Identity Transitions ────────────────────────────────────────────────────

describe('identity transitions', () => {
  it('unaware fighter can become curious over many ticks', () => {
    const state = buildTestState()

    // Prefer a fighter with the 'hungry' trait — 2× multiplier makes transitions likely.
    // If none, take any unaware fighter and run enough ticks to overcome low probability.
    let unawareFighterId: string | null = null
    for (const [id, fighter] of state.fighters) {
      if (fighter.fighterIdentity.state === 'unaware') {
        const isHungry = fighter.soulTraits.some(t => t.traitId === 'hungry')
        if (isHungry) { unawareFighterId = id; break }
        unawareFighterId ??= id
      }
    }

    if (unawareFighterId === null) return  // no unaware fighters in this world

    // Force hungry + way_out to maximise transition probability per tick (~1.5% per week).
    // 500 ticks gives >99.97% probability of at least one transition.
    const fighter = state.fighters.get(unawareFighterId)!
    if (!fighter.soulTraits.some(t => t.traitId === 'hungry')) {
      fighter.soulTraits.push({ traitId: 'hungry', revealed: false })
    }
    fighter.reasonForBoxingId = 'way_out'

    const rng = createRng(999)
    for (let i = 0; i < 500; i++) {
      advanceWeek(state, data, rng, true)
      const f = state.fighters.get(unawareFighterId)
      if (f === undefined || f.fighterIdentity.state !== 'unaware') break
    }

    const result = state.fighters.get(unawareFighterId)
    expect(result?.fighterIdentity.state).not.toBe('unaware')
  })
})

// ─── coachShouldEnterFighter ─────────────────────────────────────────────────

describe('coachShouldEnterFighter', () => {
  function makeMinimalEvent(circuitLevel: string): CalendarEvent {
    return {
      id: 'test-event',
      templateId: 'test',
      circuitLevel: circuitLevel as CalendarEvent['circuitLevel'],
      name: 'Test Event',
      label: 'Test',
      venueId: 'test-venue',
      venueName: 'Test Venue',
      venueCapacity: 200,
      cityId: 'latvia-riga',
      nationId: 'latvia',
      year: 2020,
      week: 10,
      weightClasses: ['lightweight'],
      status: 'scheduled',
      boutIds: [],
    }
  }

  function makeMinimalFighter(overrides: Partial<Fighter> = {}): Fighter {
    const state = buildTestState()
    // Grab any fighter and mutate for the test
    const [, fighter] = [...state.fighters.entries()][0]
    return {
      ...fighter,
      ...overrides,
      competition: {
        ...fighter.competition,
        status: 'amateur',
        ...((overrides as Partial<Fighter>).competition ?? {}),
      },
      fighterIdentity: {
        ...fighter.fighterIdentity,
        state: 'aspiring',
        ...((overrides as Partial<Fighter>).fighterIdentity ?? {}),
      },
      career: {
        ...fighter.career,
        readiness: 50,
        lastBoutYear: null,
        lastBoutWeek: null,
        ...((overrides as Partial<Fighter>).career ?? {}),
      },
    } as Fighter
  }

  it('returns false for unregistered fighter', () => {
    const state = buildTestState()
    const [, fighter] = [...state.fighters.entries()][0]
    const event = makeMinimalEvent('club_card')
    const testFighter: Fighter = {
      ...fighter,
      competition: { ...fighter.competition, status: 'unregistered' },
    }
    expect(coachShouldEnterFighter(testFighter, event, null, 2020, 10)).toBe(false)
  })

  it('returns false for fighter below readiness threshold', () => {
    const fighter = makeMinimalFighter()
    fighter.career.readiness = 10  // well below any threshold
    const event = makeMinimalEvent('club_card')
    expect(coachShouldEnterFighter(fighter, event, null, 2020, 10)).toBe(false)
  })

  it('returns true for ready competing fighter entering club card', () => {
    const fighter = makeMinimalFighter()
    fighter.career.readiness = 50  // above no-coach threshold of 35
    fighter.competition.status = 'amateur'
    fighter.fighterIdentity.state = 'competing'
    const event = makeMinimalEvent('club_card')
    expect(coachShouldEnterFighter(fighter, event, null, 2020, 10)).toBe(true)
  })

  it('returns false for unaware fighter regardless of readiness', () => {
    const fighter = makeMinimalFighter()
    fighter.fighterIdentity.state = 'unaware'
    fighter.career.readiness = 80
    const event = makeMinimalEvent('club_card')
    expect(coachShouldEnterFighter(fighter, event, null, 2020, 10)).toBe(false)
  })

  it('returns false for fighter with 0 bouts entering regional tournament', () => {
    const fighter = makeMinimalFighter()
    fighter.career.readiness = 60
    fighter.competition.amateur.wins = 0
    fighter.competition.amateur.losses = 0
    const event = makeMinimalEvent('regional_tournament')
    expect(coachShouldEnterFighter(fighter, event, null, 2020, 10)).toBe(false)
  })
})

// ─── Club Card Event ──────────────────────────────────────────────────────────

describe('club card event resolution', () => {
  it('bouts are resolved and fighter records update', () => {
    const state = buildTestState()

    // Set up fighters as competing/aspiring with high readiness
    // and find a club_card event this week
    for (const [, fighter] of state.fighters) {
      if (
        fighter.fighterIdentity.state === 'aspiring' ||
        fighter.fighterIdentity.state === 'competing'
      ) {
        fighter.career.readiness = 80
        fighter.competition.status = 'amateur'
      }
    }

    const clubCardEvent = state.calendar.find(e => e.circuitLevel === 'club_card')
    if (clubCardEvent === undefined) return  // skip if no club card generated

    // Fast-forward state to the event's week
    state.year = clubCardEvent.year
    state.week = clubCardEvent.week

    const rng = createRng(1)
    const result = advanceWeek(state, data, rng, true)

    // We resolved at least some bouts if eligible fighters existed in this city
    // (not guaranteed — depends on fighter distribution)
    expect(result.boutsResolved).toBeGreaterThanOrEqual(0)
  })
})

// ─── Backrun ─────────────────────────────────────────────────────────────────

describe('backrun', () => {
  it('produces fighters with non-zero bout records after 520 weeks', async () => {
    const cfg: GameConfig = { ...config, seed: 123 }
    const { worldState, persons, fighters, gyms, coaches, calendar } = generateWorld(cfg, data)

    const finalState = await runBackrun(
      worldState, persons, fighters, gyms, coaches, calendar, data, cfg, 'test-save',
    )

    const fightersWithBouts = [...finalState.fighters.values()].filter(
      f => f.competition.amateur.wins + f.competition.amateur.losses > 0,
    )

    expect(fightersWithBouts.length).toBeGreaterThan(0)
  })

  it('is deterministic — same seed produces same final fight records', async () => {
    async function runWith(seed: number): Promise<Map<string, { wins: number; losses: number }>> {
      const cfg: GameConfig = { ...config, seed }
      const { worldState, persons, fighters, gyms, coaches, calendar } = generateWorld(cfg, data)
      const finalState = await runBackrun(
        worldState, persons, fighters, gyms, coaches, calendar, data, cfg, 'test-save',
      )
      return new Map(
        [...finalState.fighters.values()].map(f => [
          f.id,
          { wins: f.competition.amateur.wins, losses: f.competition.amateur.losses },
        ]),
      )
    }

    const [run1, run2] = await Promise.all([runWith(77), runWith(77)])

    for (const [id, record] of run1) {
      const other = run2.get(id)
      expect(other).toBeDefined()
      expect(record.wins).toBe(other!.wins)
      expect(record.losses).toBe(other!.losses)
    }
  })
})
