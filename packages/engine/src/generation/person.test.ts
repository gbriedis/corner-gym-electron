import { describe, it, expect, beforeAll } from 'vitest'
import { loadGameData } from '../data/loader.js'
import { createRng } from '../utils/rng.js'
import { generatePerson } from './person.js'
import type { GameData } from '../data/loader.js'
import type { Person } from '../types/person.js'

let data: GameData
let person: Person

beforeAll(() => {
  data = loadGameData()
  person = generatePerson(data, createRng(12345), 'latvia', 'latvia-riga')
})

describe('generatePerson — required fields', () => {
  it('has all required top-level fields', () => {
    expect(person.id).toBeTruthy()
    expect(person.name.first).toBeTruthy()
    expect(person.name.surname).toBeTruthy()
    expect(typeof person.age).toBe('number')
    expect(person.nationId).toBe('latvia')
    expect(person.cityId).toBe('latvia-riga')
    expect(person.economicStatusId).toBeTruthy()
    expect(person.reasonForBoxingId).toBeTruthy()
  })

  it('has all soul traits, health values, attributes, and gifts/flaws arrays', () => {
    expect(Array.isArray(person.soulTraits)).toBe(true)
    expect(Array.isArray(person.health)).toBe(true)
    expect(Array.isArray(person.attributes)).toBe(true)
    expect(Array.isArray(person.giftsAndFlaws)).toBe(true)
  })

  it('has correct attribute count matching data', () => {
    expect(person.attributes).toHaveLength(data.attributes.attributes.length)
  })

  it('has correct health value count matching body parts', () => {
    expect(person.health).toHaveLength(data.health.bodyParts.length)
  })
})

describe('generatePerson — soul traits', () => {
  it('has one trait per pair (8 traits total)', () => {
    expect(person.soulTraits).toHaveLength(8)
  })

  it('no person holds both a trait and its opposite', () => {
    const assignedIds = new Set(person.soulTraits.map(t => t.traitId))
    for (const trait of data.soulTraits.traits) {
      if (assignedIds.has(trait.id)) {
        expect(assignedIds.has(trait.opposite)).toBe(false)
      }
    }
  })

  it('all assigned soul trait ids exist in data', () => {
    const validIds = new Set(data.soulTraits.traits.map(t => t.id))
    for (const assignment of person.soulTraits) {
      expect(validIds.has(assignment.traitId)).toBe(true)
    }
  })

  it('all soul traits start unrevealed', () => {
    for (const trait of person.soulTraits) {
      expect(trait.revealed).toBe(false)
    }
  })
})

describe('generatePerson — attributes', () => {
  it('all attribute current and potential values are within 1-20', () => {
    for (const attr of person.attributes) {
      expect(attr.current).toBeGreaterThanOrEqual(1)
      expect(attr.current).toBeLessThanOrEqual(20)
      expect(attr.potential).toBeGreaterThanOrEqual(1)
      expect(attr.potential).toBeLessThanOrEqual(20)
    }
  })

  it('current never exceeds potential', () => {
    for (const attr of person.attributes) {
      expect(attr.current).toBeLessThanOrEqual(attr.potential)
    }
  })

  it('all attribute ids exist in data', () => {
    const validIds = new Set(data.attributes.attributes.map(a => a.id))
    for (const attr of person.attributes) {
      expect(validIds.has(attr.attributeId)).toBe(true)
    }
  })

  it('gift-eligible attributes without a gift never exceed 18 at generation', () => {
    const giftEligibleIds = new Set(
      data.attributes.attributes
        .filter(a => a.scale.generationMax !== undefined)
        .map(a => a.id),
    )
    const giftedAttributeIds = new Set(
      person.giftsAndFlaws
        .filter(a => a.type === 'gift')
        .map(a => a.appliesTo),
    )

    for (const attr of person.attributes) {
      if (giftEligibleIds.has(attr.attributeId) && !giftedAttributeIds.has(attr.attributeId)) {
        expect(attr.potential).toBeLessThanOrEqual(18)
      }
    }
  })

  it('gift-eligible attribute WITH a gift can have potential 19 or 20 (sample check over many seeds)', () => {
    // Run enough seeds that at least one should produce a gift reaching 19-20.
    // Gift probability is ~4%; 200 seeds gives >99.97% chance of at least one.
    let foundAbove18 = false
    for (let seed = 1; seed <= 200; seed++) {
      const p = generatePerson(data, createRng(seed), 'latvia', 'latvia-riga')
      const gifted = p.giftsAndFlaws.filter(a => a.type === 'gift')
      for (const g of gifted) {
        const attrVal = p.attributes.find(a => a.attributeId === g.appliesTo)
        if (attrVal !== undefined && attrVal.potential >= 19) {
          foundAbove18 = true
          break
        }
      }
      if (foundAbove18) break
    }
    expect(foundAbove18).toBe(true)
  })
})

describe('generatePerson — health', () => {
  it('all health integrity values are within 1-20', () => {
    for (const hv of person.health) {
      expect(hv.integrity).toBeGreaterThanOrEqual(1)
      expect(hv.integrity).toBeLessThanOrEqual(20)
    }
  })

  it('all health damage values start at 0', () => {
    for (const hv of person.health) {
      expect(hv.damage).toBe(0)
    }
  })

  it('all body part ids exist in data', () => {
    const validIds = new Set(data.health.bodyParts.map(p => p.id))
    for (const hv of person.health) {
      expect(validIds.has(hv.bodyPartId)).toBe(true)
    }
  })
})

describe('generatePerson — physical profile', () => {
  it('physical profile band ids are valid ids from physical-stats data', () => {
    const validHandIds = new Set(data.physicalStats.handSizeProfile.bands.map(b => b.id))
    const validNeckIds = new Set(data.physicalStats.neckThicknessProfile.bands.map(b => b.id))
    const validBoneIds = new Set(data.physicalStats.boneDensityProfile.bands.map(b => b.id))
    const validPropIds = new Set(data.physicalStats.bodyProportionsProfile.bands.map(b => b.id))

    expect(validHandIds.has(person.physicalProfile.handSize)).toBe(true)
    expect(validNeckIds.has(person.physicalProfile.neckThickness)).toBe(true)
    expect(validBoneIds.has(person.physicalProfile.boneDensity)).toBe(true)
    expect(validPropIds.has(person.physicalProfile.bodyProportions)).toBe(true)
  })

  it('height and reach are plausible values in cm', () => {
    expect(person.physicalProfile.heightCm).toBeGreaterThan(150)
    expect(person.physicalProfile.heightCm).toBeLessThan(210)
    expect(person.physicalProfile.reachCm).toBeGreaterThan(145)
    expect(person.physicalProfile.reachCm).toBeLessThan(230)
  })

  it('weight is a plausible value in kg', () => {
    expect(person.physicalProfile.weightKg).toBeGreaterThan(45)
    expect(person.physicalProfile.weightKg).toBeLessThan(130)
  })
})

describe('generatePerson — identity', () => {
  it('name comes from the correct nation name pool', () => {
    const validFirstNames = new Set(data.nations.latvia.names.male.firstNames)
    const validSurnames = new Set(data.nations.latvia.names.male.surnames)
    expect(validFirstNames.has(person.name.first)).toBe(true)
    expect(validSurnames.has(person.name.surname)).toBe(true)
  })

  it('city belongs to the specified nation', () => {
    const validCityIds = new Set(data.nations.latvia.cities.cities.map(c => c.id))
    expect(validCityIds.has(person.cityId)).toBe(true)
  })

  it('economic status id exists in data', () => {
    const validIds = new Set(data.nations.latvia.economicStatuses.statuses.map(s => s.id))
    expect(validIds.has(person.economicStatusId)).toBe(true)
  })

  it('reason for boxing id exists in data', () => {
    const validIds = new Set(data.nations.latvia.reasonsForBoxing.reasons.map(r => r.id))
    expect(validIds.has(person.reasonForBoxingId)).toBe(true)
  })
})

describe('generatePerson — determinism', () => {
  it('same seed produces the same person every time', () => {
    const p1 = generatePerson(data, createRng(99999), 'latvia', 'latvia-valmiera')
    const p2 = generatePerson(data, createRng(99999), 'latvia', 'latvia-valmiera')
    expect(p1).toEqual(p2)
  })

  it('different seeds produce different people', () => {
    const p1 = generatePerson(data, createRng(1), 'latvia', 'latvia-riga')
    const p2 = generatePerson(data, createRng(2), 'latvia', 'latvia-riga')
    expect(p1.id).not.toBe(p2.id)
  })
})

describe('generatePerson — age factor', () => {
  it('a generated 16-year-old has lower current attribute values than potential on average', () => {
    // Run several seeds to find a stable 16-year-old and verify the pattern holds.
    // Age 16 has a factor of ~0.60, so current should be well below potential.
    const youngPeople: Person[] = []
    for (let seed = 0; seed < 500; seed++) {
      const p = generatePerson(data, createRng(seed), 'latvia', 'latvia-riga')
      if (p.age === 16) youngPeople.push(p)
      if (youngPeople.length >= 5) break
    }

    expect(youngPeople.length).toBeGreaterThan(0)

    for (const p of youngPeople) {
      const totalPotential = p.attributes.reduce((s, a) => s + a.potential, 0)
      const totalCurrent = p.attributes.reduce((s, a) => s + a.current, 0)
      // At age 16 the factor is 0.60, so total current should be clearly below total potential.
      expect(totalCurrent).toBeLessThan(totalPotential)
    }
  })

  it('a 28-year-old has current close to potential (within 5% on average)', () => {
    const peakPeople: Person[] = []
    for (let seed = 0; seed < 500; seed++) {
      const p = generatePerson(data, createRng(seed), 'latvia', 'latvia-riga')
      if (p.age === 28) peakPeople.push(p)
      if (peakPeople.length >= 5) break
    }

    expect(peakPeople.length).toBeGreaterThan(0)

    for (const p of peakPeople) {
      const totalPotential = p.attributes.reduce((s, a) => s + a.potential, 0)
      const totalCurrent = p.attributes.reduce((s, a) => s + a.current, 0)
      // At age 28 the factor is 0.98, so total current should be very close to total potential.
      expect(totalCurrent / totalPotential).toBeGreaterThan(0.93)
    }
  })
})
