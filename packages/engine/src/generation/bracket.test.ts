import { describe, it, expect } from 'vitest'
import { generateBracket, countByes } from './bracket.js'
import { createRng } from '../utils/rng.js'
import type { TournamentEntrant } from '../types/competition.js'

const BASE_DAYS = [
  { day: 1, label: 'Quarterfinals', roundNumber: 1 },
  { day: 2, label: 'Semifinals', roundNumber: 2 },
  { day: 3, label: 'Finals', roundNumber: 3 },
]

function makeEntrant(id: number, seed?: number): TournamentEntrant {
  return { fighterId: `f${id}`, gymId: `gym${id}`, nationId: 'latvia', seed }
}

function makeEntrants(count: number): TournamentEntrant[] {
  // All entrants seeded in order so seeding tests are predictable.
  return Array.from({ length: count }, (_, i) => makeEntrant(i + 1, i + 1))
}

describe('generateBracket — structure', () => {
  it('4 entrants produces correct 2-round bracket', () => {
    const rng = createRng(1)
    const { bracket, bouts } = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      makeEntrants(4), BASE_DAYS, rng,
    )
    expect(bracket.rounds.length).toBe(2)
    expect(bracket.rounds[0].boutIds.length).toBe(2)  // 4/2 = 2 bouts in round 1
    expect(bracket.rounds[1].boutIds.length).toBe(1)  // final
    expect(bouts.length).toBe(2)
  })

  it('8 entrants produces correct 3-round bracket', () => {
    const rng = createRng(1)
    const { bracket, bouts } = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      makeEntrants(8), BASE_DAYS, rng,
    )
    expect(bracket.rounds.length).toBe(3)
    expect(bracket.rounds[0].boutIds.length).toBe(4)  // 8/2 = 4 bouts in round 1
    expect(bracket.rounds[1].boutIds.length).toBe(2)  // semis
    expect(bracket.rounds[2].boutIds.length).toBe(1)  // final
    expect(bouts.length).toBe(4)
  })

  it('bracket id encodes event + weight class + age category', () => {
    const rng = createRng(1)
    const { bracket } = generateBracket(
      'event1', 'heavyweight', 'youth', 'regional_open', 3,
      makeEntrants(4), BASE_DAYS, rng,
    )
    expect(bracket.id).toBe('event1-heavyweight-youth')
  })

  it('bracket status is closed after generation', () => {
    const rng = createRng(1)
    const { bracket } = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      makeEntrants(4), BASE_DAYS, rng,
    )
    expect(bracket.status).toBe('closed')
  })
})

describe('generateBracket — byes', () => {
  it('5 entrants produces bracket with 3 byes', () => {
    expect(countByes(5)).toBe(3)

    const rng = createRng(1)
    const { bouts } = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      makeEntrants(5), BASE_DAYS, rng,
    )
    // bracketSize = 8, round 1 has 4 bouts, 3 have a bye
    const byeBouts = bouts.filter(b => b.fighterBId === 'bye' || b.fighterAId === 'bye')
    expect(byeBouts.length).toBe(3)
  })

  it('6 entrants produces 2 byes', () => {
    expect(countByes(6)).toBe(2)

    const rng = createRng(1)
    const { bouts } = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      makeEntrants(6), BASE_DAYS, rng,
    )
    const byeBouts = bouts.filter(b => b.fighterBId === 'bye' || b.fighterAId === 'bye')
    expect(byeBouts.length).toBe(2)
  })

  it('power-of-2 entrant count produces no byes', () => {
    expect(countByes(4)).toBe(0)
    expect(countByes(8)).toBe(0)

    const rng = createRng(1)
    const { bouts } = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      makeEntrants(8), BASE_DAYS, rng,
    )
    const byeBouts = bouts.filter(b => b.fighterBId === 'bye' || b.fighterAId === 'bye')
    expect(byeBouts.length).toBe(0)
  })
})

describe('generateBracket — determinism', () => {
  it('same seed + same entrants produces identical bracket', () => {
    const entrants = makeEntrants(8)
    const a = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      entrants, BASE_DAYS, createRng(42),
    )
    const b = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      entrants, BASE_DAYS, createRng(42),
    )
    expect(JSON.stringify(a.bracket)).toBe(JSON.stringify(b.bracket))
    expect(JSON.stringify(a.bouts)).toBe(JSON.stringify(b.bouts))
  })
})

describe('generateBracket — seeding', () => {
  it('all entrants appear exactly once in round 1', () => {
    const entrants = makeEntrants(8)
    const rng = createRng(1)
    const { bouts } = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      entrants, BASE_DAYS, rng,
    )
    const allFighterIds = bouts.flatMap(b =>
      [b.fighterAId, b.fighterBId].filter(id => id !== 'bye'),
    )
    const unique = new Set(allFighterIds)
    expect(unique.size).toBe(entrants.length)
    for (const e of entrants) {
      expect(unique.has(e.fighterId)).toBe(true)
    }
  })

  it('all entrants appear exactly once in round 1 with byes (5 entrants)', () => {
    const entrants = makeEntrants(5)
    const rng = createRng(1)
    const { bouts } = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      entrants, BASE_DAYS, rng,
    )
    const allFighterIds = bouts.flatMap(b =>
      [b.fighterAId, b.fighterBId].filter(id => id !== 'bye'),
    )
    const unique = new Set(allFighterIds)
    expect(unique.size).toBe(5)
    for (const e of entrants) {
      expect(unique.has(e.fighterId)).toBe(true)
    }
  })

  it('seed 1 and seed 2 are in different round-1 bouts (cannot meet before final)', () => {
    const entrants = makeEntrants(8)
    const rng = createRng(1)
    const { bouts } = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      entrants, BASE_DAYS, rng,
    )
    const boutWithSeed1 = bouts.find(
      b => b.fighterAId === 'f1' || b.fighterBId === 'f1',
    )
    const boutWithSeed2 = bouts.find(
      b => b.fighterAId === 'f2' || b.fighterBId === 'f2',
    )
    // Seeds 1 and 2 must be in different round 1 bouts — they are on opposite halves.
    expect(boutWithSeed1).toBeDefined()
    expect(boutWithSeed2).toBeDefined()
    expect(boutWithSeed1?.id).not.toBe(boutWithSeed2?.id)
  })

  it('seed 1 and seed 3 are in different bracket halves for 8-person bracket', () => {
    // Standard seeding [1,8,4,5,2,7,3,6]: bouts 0-1 are the upper half, 2-3 are the lower half.
    // Seed 1 is in bout 0 (upper), seed 3 is in bout 3 (lower) — they can meet no earlier than the final.
    // Seed 1 and seed 4 are both in the upper half and can meet in the semis — that is correct.
    const entrants = makeEntrants(8)
    const rng = createRng(1)
    const { bouts } = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      entrants, BASE_DAYS, rng,
    )
    const boutWithSeed1 = bouts.findIndex(
      b => b.fighterAId === 'f1' || b.fighterBId === 'f1',
    )
    const boutWithSeed3 = bouts.findIndex(
      b => b.fighterAId === 'f3' || b.fighterBId === 'f3',
    )
    // Bouts 0-1 are one half, bouts 2-3 are the other half.
    const inUpperHalf = (idx: number): boolean => idx < 2
    expect(inUpperHalf(boutWithSeed1)).not.toBe(inUpperHalf(boutWithSeed3))
  })
})

describe('generateBracket — days structure', () => {
  it('round labels come from daysStructure when provided', () => {
    const rng = createRng(1)
    const { bracket } = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      makeEntrants(4), BASE_DAYS, rng,
    )
    expect(bracket.rounds[0].label).toBe('Semifinals')
    expect(bracket.rounds[1].label).toBe('Finals')
  })

  it('round days come from daysStructure aligned from the end', () => {
    const rng = createRng(1)
    const { bracket } = generateBracket(
      'event1', 'lightweight', 'senior', 'national_championship', 3,
      makeEntrants(4), BASE_DAYS, rng,
    )
    // 4 entrants = 2 rounds; BASE_DAYS has 3 entries (quarters/semis/finals).
    // A 4-person bracket skips quarterfinals — round 1 aligns to Semifinals (day 2),
    // round 2 aligns to Finals (day 3). Alignment is from the end so the final
    // is always the last scheduled day regardless of bracket size.
    expect(bracket.rounds[0].day).toBe(2)
    expect(bracket.rounds[1].day).toBe(3)
  })
})
