import { describe, it, expect, beforeAll } from 'vitest'
import { loadGameData } from '../data/loader.js'
import { createRng } from '../utils/rng.js'
import { generatePerson } from './person.js'
import { generateCoach } from './coach.js'
import type { GameData } from '../data/loader.js'
import type { Person } from '../types/person.js'

let data: GameData
let basePerson: Person

const PERSON_SEED = 42000
const COACH_SEED = 77777

beforeAll(() => {
  data = loadGameData()
  basePerson = generatePerson(data, createRng(PERSON_SEED), 'latvia', 'latvia-riga')
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTraits(ids: string[]): Person['soulTraits'] {
  const all8Pairs = [
    ['brave', 'craven'],
    ['calm', 'panicky'],
    ['humble', 'arrogant'],
    ['patient', 'impatient'],
    ['trusting', 'paranoid'],
    ['disciplined', 'reckless'],
    ['determined', 'fragile'],
    ['hungry', 'content'],
  ]
  return all8Pairs.map(([a, b]) => {
    const chosen = ids.includes(a) ? a : ids.includes(b) ? b : a
    return { traitId: chosen, revealed: false }
  })
}

function makePerson(overrides: Partial<Pick<Person, 'soulTraits' | 'age'>>): Person {
  return { ...basePerson, ...overrides }
}

// ─── Quality — former fighter ─────────────────────────────────────────────────

describe('generateCoach — former fighter quality', () => {
  it('national championship career produces quality > 8', () => {
    // National championship prestige = 7. baseQuality = (7/7)*10 = 10.
    // Even with neutral traits, should land well above 8.
    const person = makePerson({ soulTraits: makeTraits(['brave', 'calm']) })
    const coach = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: true,
      careerPeakCircuitLevel: 'national_championship',
      careerPeakPrestige: 7,
      fightingStyleTendency: 'boxer',
    })
    expect(coach.quality).toBeGreaterThan(8)
  })

  it('humble + patient traits produce higher quality than arrogant + reckless for same career', () => {
    // humble+patient give +4 total; arrogant+reckless give -4 total.
    // Same career peak (prestige 5) — the trait spread should be clearly visible.
    const good = makePerson({ soulTraits: makeTraits(['humble', 'patient']) })
    const bad = makePerson({ soulTraits: makeTraits(['arrogant', 'reckless']) })

    const goodCoach = generateCoach(good, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: true,
      careerPeakPrestige: 5,
      fightingStyleTendency: 'boxer',
    })
    const badCoach = generateCoach(bad, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: true,
      careerPeakPrestige: 5,
      fightingStyleTendency: 'boxer',
    })
    expect(goodCoach.quality).toBeGreaterThan(badCoach.quality)
  })
})

// ─── Style — emphasis overrides ───────────────────────────────────────────────

describe('generateCoach — coaching style emphasis', () => {
  it('former brawler with humble + patient gets technical emphasis (trait overrides background)', () => {
    // humble+patient drift overrides fighting background.
    // Humble patient coaches study what fighters need, not what they personally did.
    const person = makePerson({ soulTraits: makeTraits(['humble', 'patient']) })
    const coach = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: true,
      careerPeakPrestige: 3,
      fightingStyleTendency: 'brawler',
    })
    expect(coach.style.emphasis).toBe('technical')
  })

  it('former boxer gets technical emphasis by default (no drift traits)', () => {
    // boxer → technical without any drift traits.
    const person = makePerson({ soulTraits: makeTraits(['brave', 'calm']) })
    const coach = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: true,
      careerPeakPrestige: 3,
      fightingStyleTendency: 'boxer',
    })
    expect(coach.style.emphasis).toBe('technical')
  })

  it('former counterpuncher gets technical emphasis by default', () => {
    const person = makePerson({ soulTraits: makeTraits(['calm', 'trusting']) })
    const coach = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: true,
      careerPeakPrestige: 3,
      fightingStyleTendency: 'counterpuncher',
    })
    expect(coach.style.emphasis).toBe('technical')
  })
})

// ─── Quality — specialist ─────────────────────────────────────────────────────

describe('generateCoach — specialist quality', () => {
  it('specialist new quality lands within declared range [5, 9]', () => {
    const person = makePerson({ soulTraits: makeTraits(['humble']) })
    const coach = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: false,
      specialistExperience: 'new',
    })
    // Before years adjustment, quality should be in [5, 9].
    // yearsCoaching=0 so no growth — raw range applies.
    expect(coach.quality).toBeGreaterThanOrEqual(5)
    expect(coach.quality).toBeLessThanOrEqual(9)
  })

  it('specialist veteran quality lands within declared range [12, 16]', () => {
    const person = makePerson({ soulTraits: makeTraits(['humble']) })
    const coach = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: false,
      specialistExperience: 'veteran',
    })
    expect(coach.quality).toBeGreaterThanOrEqual(12)
    expect(coach.quality).toBeLessThanOrEqual(16)
  })
})

// ─── Quality growth ───────────────────────────────────────────────────────────

describe('generateCoach — quality grows with experience', () => {
  it('quality grows toward potential when yearsCoaching > 0', () => {
    const person = makePerson({ soulTraits: makeTraits(['humble', 'patient']) })

    const fresh = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: true,
      careerPeakPrestige: 3,
      fightingStyleTendency: 'boxer',
      yearsCoaching: 0,
    })
    const experienced = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: true,
      careerPeakPrestige: 3,
      fightingStyleTendency: 'boxer',
      yearsCoaching: 10,
    })
    expect(experienced.quality).toBeGreaterThan(fresh.quality)
  })

  it('quality never exceeds qualityPotential regardless of yearsCoaching', () => {
    const person = makePerson({ soulTraits: makeTraits(['humble', 'patient']) })

    // Very long coaching career — quality should be clamped at potential.
    const coach = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: true,
      careerPeakPrestige: 7,
      fightingStyleTendency: 'boxer',
      yearsCoaching: 100,
    })
    expect(coach.quality).toBeLessThanOrEqual(coach.qualityPotential)
  })
})

// ─── Style certainty ─────────────────────────────────────────────────────────

describe('generateCoach — style certainty caps', () => {
  it('style certainty capped at maximumStyleCertaintyGymMember for isGymMemberFilling', () => {
    const coachGeneration = data.nations['latvia']?.coachGeneration
    expect(coachGeneration).toBeDefined()
    const cap = coachGeneration!.maximumStyleCertaintyGymMember

    const person = makePerson({ soulTraits: makeTraits(['humble', 'patient']) })
    const coach = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: true,
      careerPeakPrestige: 7,
      fightingStyleTendency: 'boxer',
      yearsCoaching: 50,  // large enough to push past any cap
      isGymMemberFilling: true,
    })
    expect(coach.styleCertainty).toBeLessThanOrEqual(cap)
  })
})

// ─── Communication style ─────────────────────────────────────────────────────

describe('generateCoach — communication styles', () => {
  it('brave + determined without fragile produces demanding communication style', () => {
    const person = makePerson({ soulTraits: makeTraits(['brave', 'determined']) })
    const coach = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: false,
      specialistExperience: 'experienced',
    })
    expect(coach.style.communicationStyle).toBe('demanding')
  })

  it('humble + patient without arrogant or demanding traits produces supportive communication style', () => {
    // craven + fragile ensure the demanding check (brave/determined AND NOT fragile)
    // does not fire, leaving humble+patient to determine the style.
    const person = makePerson({ soulTraits: makeTraits(['humble', 'patient', 'craven', 'fragile']) })
    const coach = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: false,
      specialistExperience: 'experienced',
    })
    expect(coach.style.communicationStyle).toBe('supportive')
  })
})

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('generateCoach — determinism', () => {
  it('same seed produces identical coach', () => {
    const person = makePerson({ soulTraits: makeTraits(['brave', 'patient']) })

    const a = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: true,
      careerPeakPrestige: 5,
      fightingStyleTendency: 'boxer',
      yearsCoaching: 5,
    })
    const b = generateCoach(person, 'gym-1', data, createRng(COACH_SEED), {
      formerFighter: true,
      careerPeakPrestige: 5,
      fightingStyleTendency: 'boxer',
      yearsCoaching: 5,
    })

    expect(a.id).toBe(b.id)
    expect(a.quality).toBe(b.quality)
    expect(a.qualityPotential).toBe(b.qualityPotential)
    expect(a.styleCertainty).toBe(b.styleCertainty)
    expect(a.style.emphasis).toBe(b.style.emphasis)
    expect(a.style.methodology).toBe(b.style.methodology)
    expect(a.style.communicationStyle).toBe(b.style.communicationStyle)
  })
})
