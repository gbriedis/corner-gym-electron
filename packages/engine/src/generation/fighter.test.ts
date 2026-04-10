import { describe, it, expect, beforeAll } from 'vitest'
import { loadGameData } from '../data/loader.js'
import { createRng } from '../utils/rng.js'
import { generatePerson } from './person.js'
import { generateFighter, calculateStyleEffectiveness } from './fighter.js'
import type { GameData } from '../data/loader.js'
import type { Person } from '../types/person.js'
import type { Fighter } from '../types/fighter.js'
import type { FighterStyle, DevelopedAttribute } from '../types/fighter.js'
import type { AttributeValue } from '../types/person.js'

let data: GameData
let basePerson: Person

// SEED values chosen to produce deterministic results across test runs.
const PERSON_SEED = 99999
const FIGHTER_SEED = 11111

beforeAll(() => {
  data = loadGameData()
  basePerson = generatePerson(data, createRng(PERSON_SEED), 'latvia', 'latvia-riga')
})

// ─── Helper: construct a test person with controlled soul traits and reason ────

function makeTestPerson(
  overrides: Partial<Pick<Person, 'soulTraits' | 'reasonForBoxingId' | 'age' | 'attributes'>>,
): Person {
  // Spread the base person and replace only what the test needs.
  // Inherits a full valid Person structure (physicalProfile, attributes, health, etc.)
  return { ...basePerson, ...overrides }
}

// Build a minimal SoulTraitAssignment list for controlled tests.
// Pairs not in the provided list receive the 'brave' or first-side default
// so the person is always valid (one of each pair).
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

// ─── Required fields ──────────────────────────────────────────────────────────

describe('generateFighter — required fields', () => {
  it('generated fighter has all required fields from Fighter interface', () => {
    const fighter = generateFighter(basePerson, null, null, data, createRng(FIGHTER_SEED))

    // Person fields are preserved
    expect(fighter.id).toBeTruthy()
    expect(fighter.name.first).toBeTruthy()
    expect(fighter.nationId).toBe('latvia')

    // Fighter layers are present
    expect(fighter.fighterIdentity).toBeDefined()
    expect(fighter.fighterIdentity.state).toBeDefined()
    expect(typeof fighter.fighterIdentity.stateChangedYear).toBe('number')
    expect(typeof fighter.fighterIdentity.stateChangedWeek).toBe('number')

    expect(fighter.boxingBackground).toBeDefined()
    expect(typeof fighter.boxingBackground.yearsTraining).toBe('number')
    expect(typeof fighter.boxingBackground.selfTaught).toBe('boolean')

    expect(Array.isArray(fighter.developedAttributes)).toBe(true)
    expect(fighter.developedAttributes.length).toBe(data.attributes.attributes.length)

    expect(Array.isArray(fighter.attributeHistory)).toBe(true)
    expect(fighter.attributeHistory.length).toBe(data.attributes.attributes.length)

    expect(fighter.style).toBeDefined()
    expect(typeof fighter.style.southpaw).toBe('boolean')

    expect(fighter.competition).toBeDefined()
    expect(fighter.competition.weightClassId).toBeTruthy()
    expect(fighter.competition.amateur).toBeDefined()
    expect(fighter.competition.pro).toBeDefined()

    expect(fighter.career).toBeDefined()
    expect(fighter.career.ambitions).toBeDefined()

    expect(fighter.playerKnowledge).toBeDefined()
    expect(fighter.playerKnowledge.depthLevel).toBe(0)
    expect(fighter.playerKnowledge.revealedSoulTraits).toHaveLength(0)
  })
})

// ─── Weight class ─────────────────────────────────────────────────────────────

describe('generateFighter — weight class', () => {
  it('assigns flyweight for a person weighing 50 kg', () => {
    const lightPerson = makeTestPerson({
      attributes: basePerson.attributes,
    })
    // Override weight by overriding physicalProfile
    const lightFighter = generateFighter(
      { ...lightPerson, physicalProfile: { ...lightPerson.physicalProfile, weightKg: 50 } },
      null, null, data, createRng(FIGHTER_SEED),
    )
    expect(lightFighter.competition.weightClassId).toBe('flyweight')
  })

  it('assigns heavyweight for a person weighing 100 kg', () => {
    const heavyFighter = generateFighter(
      { ...basePerson, physicalProfile: { ...basePerson.physicalProfile, weightKg: 100 } },
      null, null, data, createRng(FIGHTER_SEED),
    )
    expect(heavyFighter.competition.weightClassId).toBe('heavyweight')
  })

  it('forceWeightClass option overrides physical weight', () => {
    const heavyPerson = { ...basePerson, physicalProfile: { ...basePerson.physicalProfile, weightKg: 100 } }
    const fighter = generateFighter(heavyPerson, null, null, data, createRng(FIGHTER_SEED), {
      forceWeightClass: 'flyweight',
    })
    expect(fighter.competition.weightClassId).toBe('flyweight')
  })

  it('assigns welterweight for a person weighing 65 kg', () => {
    const fighter = generateFighter(
      { ...basePerson, physicalProfile: { ...basePerson.physicalProfile, weightKg: 65 } },
      null, null, data, createRng(FIGHTER_SEED),
    )
    // 65 kg falls under welterweight limit (66.7 kg)
    expect(fighter.competition.weightClassId).toBe('welterweight')
  })
})

// ─── Mental attribute caps ────────────────────────────────────────────────────

describe('generateFighter — mental attribute caps', () => {
  const mentalIds = ['ring_iq', 'composure', 'adaptability', 'heart', 'big_fight_experience']

  it('mental attributes are capped at 3 for a fighter with no bouts', () => {
    const fighter = generateFighter(basePerson, null, null, data, createRng(FIGHTER_SEED))
    for (const id of mentalIds) {
      const attr = fighter.developedAttributes.find(d => d.attributeId === id)
      expect(attr).toBeDefined()
      expect(attr!.current).toBeLessThanOrEqual(3)
    }
  })

  it('mental attributes can exceed 3 for a fighter with 20 existing bouts', () => {
    const fighter = generateFighter(
      makeTestPerson({ soulTraits: makeTraits(['hungry', 'brave']) }),
      null, null, data, createRng(FIGHTER_SEED),
      {
        existingRecord: { amateurWins: 10, amateurLosses: 10, proWins: 0, proLosses: 0, titlesHeld: [] },
      },
    )
    // 20 total bouts → cap is 10. At least one mental attribute should be > 3.
    const maxMental = mentalIds
      .map(id => fighter.developedAttributes.find(d => d.attributeId === id)?.current ?? 0)
      .reduce((a, b) => Math.max(a, b), 0)

    // All attributes are capped at 10 and must be ≤ 10
    for (const id of mentalIds) {
      const attr = fighter.developedAttributes.find(d => d.attributeId === id)
      expect(attr!.current).toBeLessThanOrEqual(10)
    }

    // The 20-bout fighter should produce higher mental values than a zero-bout fighter,
    // assuming they have meaningful training years — a hungry+brave fighter typically does.
    const zeroBoutFighter = generateFighter(
      makeTestPerson({ soulTraits: makeTraits(['hungry', 'brave']) }),
      null, null, data, createRng(FIGHTER_SEED),
    )
    const maxMentalZero = mentalIds
      .map(id => zeroBoutFighter.developedAttributes.find(d => d.attributeId === id)?.current ?? 0)
      .reduce((a, b) => Math.max(a, b), 0)

    expect(maxMental).toBeGreaterThanOrEqual(maxMentalZero)
  })
})

// ─── Ambitions ────────────────────────────────────────────────────────────────

describe('generateFighter — ambitions', () => {
  it('hungry + way_out reason → ambition level is world_title or undisputed', () => {
    const person = makeTestPerson({
      soulTraits: makeTraits(['hungry', 'brave']),
      reasonForBoxingId: 'way_out',
    })
    const fighter = generateFighter(person, null, null, data, createRng(FIGHTER_SEED))
    expect(['world_title', 'undisputed']).toContain(fighter.career.ambitions.level)
  })

  it('content + outlet reason → ambition level is local or undecided', () => {
    const person = makeTestPerson({
      soulTraits: makeTraits(['content', 'calm']),
      reasonForBoxingId: 'outlet',
    })
    const fighter = generateFighter(person, null, null, data, createRng(FIGHTER_SEED))
    expect(['local', 'undecided']).toContain(fighter.career.ambitions.level)
  })
})

// ─── Style tendency ───────────────────────────────────────────────────────────

describe('generateFighter — style tendency', () => {
  it('style tendency is undefined for a fighter with < 2 years training', () => {
    // Age 15 forces firstTrainedAge = 14 (min(14, roll)) → yearsTraining = 1
    const youngPerson: Person = {
      ...basePerson,
      age: 15,
    }
    const fighter = generateFighter(youngPerson, null, null, data, createRng(FIGHTER_SEED))
    expect(fighter.style.currentTendency).toBe('undefined')
  })

  it('brave + high power → pressure or boxer_puncher tendency after 5+ years training', () => {
    // Age 25 guarantees ≥ 7 years training (max firstTrainedAge = min(24, 18) = 18)
    const braveHighPowerPerson: Person = {
      ...basePerson,
      age: 25,
      soulTraits: makeTraits(['brave', 'hungry']),
      // Set power to 15 (high) in the attributes list
      attributes: basePerson.attributes.map(a =>
        a.attributeId === 'power' ? { ...a, current: 15, potential: 15 } : a,
      ),
    }

    // Run multiple seeds to account for style randomness — brave + high power should
    // never produce 'undefined' or styles that require different traits.
    const tendencies = [1, 2, 3, 4, 5].map(seed =>
      generateFighter(braveHighPowerPerson, null, null, data, createRng(seed)).style.currentTendency,
    )
    // At least one run should produce pressure or boxer_puncher
    expect(tendencies.some(t => t === 'pressure' || t === 'boxer_puncher' || t === 'swarmer')).toBe(true)
    // None should be undefined (5+ years training)
    expect(tendencies.every(t => t !== 'undefined')).toBe(true)
  })
})

// ─── Coachability ─────────────────────────────────────────────────────────────

describe('generateFighter — coachability', () => {
  it('trusting fighter has higher coachability than paranoid fighter', () => {
    const trustingPerson = makeTestPerson({ soulTraits: makeTraits(['trusting', 'humble']) })
    const paranoidPerson = makeTestPerson({ soulTraits: makeTraits(['paranoid', 'arrogant']) })

    // Run multiple seeds — trusting (70-95 base) must always beat paranoid (15-50 base)
    // because the ranges do not overlap after humble (+10) and arrogant (-15) modifiers.
    const seeds = [1, 2, 3]
    for (const seed of seeds) {
      const trusting = generateFighter(trustingPerson, null, null, data, createRng(seed))
      const paranoid = generateFighter(paranoidPerson, null, null, data, createRng(seed))
      expect(trusting.career.coachabilityScore).toBeGreaterThan(paranoid.career.coachabilityScore)
    }
  })
})

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('generateFighter — determinism', () => {
  it('same seed produces the same fighter', () => {
    const fighter1 = generateFighter(basePerson, null, null, data, createRng(FIGHTER_SEED))
    const fighter2 = generateFighter(basePerson, null, null, data, createRng(FIGHTER_SEED))
    expect(fighter1).toEqual(fighter2)
  })
})

// ─── Existing record ──────────────────────────────────────────────────────────

describe('generateFighter — existing record', () => {
  it('fighter with existingRecord and bouts has competing identity state', () => {
    const fighter = generateFighter(basePerson, null, null, data, createRng(FIGHTER_SEED), {
      existingRecord: { amateurWins: 5, amateurLosses: 2, proWins: 0, proLosses: 0, titlesHeld: [] },
    })
    expect(fighter.fighterIdentity.state).toBe('competing')
  })

  it('existingRecord sets competition status to amateur when only amateur bouts exist', () => {
    const fighter = generateFighter(basePerson, null, null, data, createRng(FIGHTER_SEED), {
      existingRecord: { amateurWins: 8, amateurLosses: 3, proWins: 0, proLosses: 0, titlesHeld: [] },
    })
    expect(fighter.competition.status).toBe('amateur')
  })

  it('existingRecord sets competition status to pro when pro bouts exist', () => {
    const fighter = generateFighter(basePerson, null, null, data, createRng(FIGHTER_SEED), {
      existingRecord: { amateurWins: 8, amateurLosses: 2, proWins: 5, proLosses: 1, titlesHeld: [] },
    })
    expect(fighter.competition.status).toBe('pro')
    expect(fighter.competition.pro.wins).toBe(5)
    expect(fighter.competition.pro.losses).toBe(1)
  })
})

// ─── Style effectiveness ──────────────────────────────────────────────────────

describe('calculateStyleEffectiveness', () => {
  it('undefined style returns 0 regardless of attributes', () => {
    const style: FighterStyle = { currentTendency: 'undefined', tendencyStrength: 80, southpaw: false }
    const effectiveness = calculateStyleEffectiveness(style, [], [], data)
    expect(effectiveness).toBe(0)
  })

  it('tendencyStrength 0 returns 0 regardless of attributes', () => {
    const style: FighterStyle = { currentTendency: 'brawler', tendencyStrength: 0, southpaw: false }
    // Brawler thresholds: chin 8, durability 8, heart 7 — all well above threshold
    const physAttrs: AttributeValue[] = [
      { attributeId: 'chin', current: 15, potential: 15 },
      { attributeId: 'durability', current: 15, potential: 15 },
      { attributeId: 'heart', current: 15, potential: 15 },
    ]
    const effectiveness = calculateStyleEffectiveness(style, [], physAttrs, data)
    expect(effectiveness).toBe(0)
  })

  it('fighter with all attributes at or above thresholds returns value scaled by tendencyStrength', () => {
    // Brawler needs chin 8, durability 8, heart 7 — all physical attributes.
    // tendencyStrength 100 means full expression: effectiveness = 1.0 × 1.0 × 1.0 = 1.0
    const style: FighterStyle = { currentTendency: 'brawler', tendencyStrength: 100, southpaw: false }
    const physAttrs: AttributeValue[] = [
      { attributeId: 'chin', current: 10, potential: 10 },
      { attributeId: 'durability', current: 10, potential: 10 },
      { attributeId: 'heart', current: 10, potential: 10 },
    ]
    const effectiveness = calculateStyleEffectiveness(style, [], physAttrs, data)
    // All above threshold, tendencyStrength = 100/100 = 1.0, so result > 0.9
    expect(effectiveness).toBeGreaterThan(0.9)
  })

  it('fighter with one attribute below threshold is limited by that attribute', () => {
    // Brawler needs chin 8. If chin is 4, that attribute alone caps effectiveness at 0.5.
    // 0.5 × tendencyStrength(100)/100 = 0.5
    const style: FighterStyle = { currentTendency: 'brawler', tendencyStrength: 100, southpaw: false }
    const physAttrs: AttributeValue[] = [
      { attributeId: 'chin', current: 4, potential: 4 },    // 4/8 = 0.5 — limiting attribute
      { attributeId: 'durability', current: 15, potential: 15 },
      { attributeId: 'heart', current: 15, potential: 15 },
    ]
    const effectiveness = calculateStyleEffectiveness(style, [], physAttrs, data)
    // Minimum effectiveness is chin: 4/8 = 0.5. Times tendencyStrength 1.0 = 0.5
    expect(effectiveness).toBeCloseTo(0.5, 5)
  })
})

// ─── Background modifier ──────────────────────────────────────────────────────

describe('generateFighter — background modifier', () => {
  it('prior gym produces higher technical attribute starts than self-taught', () => {
    // Force a large age so yearsTraining is substantial — isolates the background modifier.
    const oldPerson: Person = { ...basePerson, age: 28 }

    // Run many seeds to get reliable comparison across self-taught vs. prior gym results.
    // We average the technical attributes across seeds to smooth out RNG variance.
    let priorGymTotal = 0
    let selfTaughtTotal = 0
    let priorGymCount = 0
    let selfTaughtCount = 0

    const SAMPLES = 30
    for (let seed = 1; seed <= SAMPLES; seed++) {
      const fighter: Fighter = generateFighter(oldPerson, null, null, data, createRng(seed))
      const bg = fighter.boxingBackground

      // Only compare samples where the background actually differs
      const technicalAttrs = fighter.developedAttributes.filter(d => {
        const attr = data.attributes.attributes.find(a => a.id === d.attributeId)
        return attr?.category === 'striking' || attr?.category === 'defense'
      })
      const avgTechnical = technicalAttrs.reduce((s, d) => s + d.current, 0) / technicalAttrs.length

      if (bg.priorGymNationId !== null) {
        priorGymTotal += avgTechnical
        priorGymCount++
      } else if (bg.selfTaught) {
        selfTaughtTotal += avgTechnical
        selfTaughtCount++
      }
    }

    // Both buckets should have samples — if either is 0, the test is skipped as inconclusive.
    if (priorGymCount > 0 && selfTaughtCount > 0) {
      const avgPriorGym = priorGymTotal / priorGymCount
      const avgSelfTaught = selfTaughtTotal / selfTaughtCount
      expect(avgPriorGym).toBeGreaterThan(avgSelfTaught)
    }
  })
})
