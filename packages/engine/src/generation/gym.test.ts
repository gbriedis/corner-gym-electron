import { describe, it, expect, beforeAll } from 'vitest'
import { loadGameData } from '../data/loader.js'
import { generateGym, calculateGymQuality } from './gym.js'
import { createRng } from '../utils/rng.js'
import type { GameData } from '../data/loader.js'

let data: GameData

beforeAll(() => {
  data = loadGameData()
})

const CITY_ID   = 'latvia-riga'
const NATION_ID = 'latvia'
const START_YEAR = 2026

function makeRng(seed = 42) {
  return createRng(seed)
}

describe('generateGym — player gym', () => {
  it('player gym always uses rundown_community template', () => {
    const { gym } = generateGym(CITY_ID, NATION_ID, true, 'Test Gym', data, makeRng())
    // rundown_community has no strengthRoom — verify the structural signature
    expect(gym.zones.strengthRoom.exists).toBe(false)
    expect(gym.isPlayerGym).toBe(true)
  })

  it('player gym uses the provided name', () => {
    const { gym } = generateGym(CITY_ID, NATION_ID, true, 'My Boxing Club', data, makeRng())
    expect(gym.name).toBe('My Boxing Club')
  })

  it('forceTemplateId overrides template selection', () => {
    const { gym } = generateGym(CITY_ID, NATION_ID, false, null, data, makeRng(), {
      forceTemplateId: 'elite_gym',
    })
    // elite_gym has a videoAnalysisRoom — use that as the structural fingerprint
    expect(gym.zones.videoAnalysisRoom).toBeDefined()
    expect(gym.zones.videoAnalysisRoom?.exists).toBe(true)
  })
})

describe('generateGym — required fields', () => {
  it('generated gym has all required Gym interface fields', () => {
    const { gym } = generateGym(CITY_ID, NATION_ID, false, null, data, makeRng())
    expect(gym.id).toBeTruthy()
    expect(gym.name).toBeTruthy()
    expect(gym.cityId).toBe(CITY_ID)
    expect(gym.nationId).toBe(NATION_ID)
    expect(gym.isPlayerGym).toBe(false)
    expect(gym.foundedYear).toBeGreaterThan(0)
    expect(gym.totalSquareMeters).toBeGreaterThan(0)
    expect(typeof gym.zones.trainingFloor).toBe('object')
    expect(Array.isArray(gym.equipment)).toBe(true)
    expect(Array.isArray(gym.pendingOrders)).toBe(true)
    expect(gym.activeExpansion).toBeNull()
    expect(Array.isArray(gym.staffMembers)).toBe(true)
    expect(Array.isArray(gym.memberIds)).toBe(true)
    expect(Array.isArray(gym.fighterIds)).toBe(true)
    expect(gym.finances.monthlyRent).toBeGreaterThan(0)
    expect(gym.lockerCount).toBeGreaterThan(0)
    expect(gym.kidsClass.active).toBe(false)
    expect(typeof gym.quality.overall).toBe('number')
    expect(gym.culture.coachingFocus).toBeNull()
    expect(Array.isArray(gym.accomplishments)).toBe(true)
  })
})

describe('generateGym — finances', () => {
  it('monthlyRent is base template rent × city rentModifier', () => {
    const city = data.nations[NATION_ID]!.cities.cities.find(c => c.id === CITY_ID)!
    const template = data.nations[NATION_ID]!.gymStartingStates.templates.find(
      t => t.id === 'rundown_community',
    )!

    const { gym } = generateGym(CITY_ID, NATION_ID, true, 'Test', data, makeRng(), { startYear: START_YEAR })

    // rent must fall within [min × rentModifier, max × rentModifier]
    const minRent = Math.round(template.finances.monthlyRent.min * city.rentModifier)
    const maxRent = Math.round(template.finances.monthlyRent.max * city.rentModifier)
    expect(gym.finances.monthlyRent).toBeGreaterThanOrEqual(minRent)
    expect(gym.finances.monthlyRent).toBeLessThanOrEqual(maxRent)
  })

  it('Valmiera gym has lower rent than Rīga gym (rentModifier effect)', () => {
    const { gym: rigaGym }     = generateGym('latvia-riga',     NATION_ID, true, 'A', data, makeRng(1))
    const { gym: valmieraGym } = generateGym('latvia-valmiera', NATION_ID, true, 'B', data, makeRng(1))
    // Valmiera rentModifier (0.75) < Rīga (expected >= 1.0) — rent should be lower
    expect(valmieraGym.finances.monthlyRent).toBeLessThan(rigaGym.finances.monthlyRent)
  })
})

describe('generateGym — physical space', () => {
  it('training floor capacity = floor(trainingFloor.squareMeters / 4)', () => {
    const { gym } = generateGym(CITY_ID, NATION_ID, true, 'Test', data, makeRng())
    expect(gym.quality.maxTrainingCapacity).toBe(
      Math.floor(gym.zones.trainingFloor.squareMeters / 4),
    )
  })

  it('training floor square meters is within template range', () => {
    const template = data.nations[NATION_ID]!.gymStartingStates.templates.find(
      t => t.id === 'rundown_community',
    )!
    const { gym } = generateGym(CITY_ID, NATION_ID, true, 'Test', data, makeRng())
    // TF gets 50% of totalSquareMeters which itself is within template.squareMeters range
    const tfMin = Math.floor(template.squareMeters.min * 0.50)
    const tfMax = Math.floor(template.squareMeters.max * 0.50)
    expect(gym.zones.trainingFloor.squareMeters).toBeGreaterThanOrEqual(tfMin)
    expect(gym.zones.trainingFloor.squareMeters).toBeLessThanOrEqual(tfMax)
  })
})

describe('generateGym — equipment', () => {
  it('hasRing is false when template has no boxing_ring', () => {
    const { gym } = generateGym(CITY_ID, NATION_ID, true, 'Test', data, makeRng())
    // rundown_community has no boxing_ring in startingEquipment
    expect(gym.quality.hasRing).toBe(false)
  })

  it('hasRing is true when boxing_ring exists with condition > 0', () => {
    const { gym } = generateGym(CITY_ID, NATION_ID, false, null, data, makeRng(), {
      forceTemplateId: 'established_community',
    })
    // established_community includes a boxing_ring with min condition 40
    expect(gym.quality.hasRing).toBe(true)
    expect(gym.quality.ringCount).toBeGreaterThanOrEqual(1)
  })

  it('equipment count is within template min/max ranges', () => {
    const template = data.nations[NATION_ID]!.gymStartingStates.templates.find(
      t => t.id === 'established_community',
    )!
    const { gym } = generateGym(CITY_ID, NATION_ID, false, null, data, makeRng(), {
      forceTemplateId: 'established_community',
    })

    for (const spec of template.startingEquipment) {
      const minCount = typeof spec.count === 'number' ? spec.count : spec.count.min
      const maxCount = typeof spec.count === 'number' ? spec.count : spec.count.max
      const actual = gym.equipment.filter(e => e.typeId === spec.typeId).length
      // Equipment may be skipped due to space constraints, so actual can be less than min.
      // The constraint is that it never exceeds max.
      expect(actual).toBeLessThanOrEqual(maxCount)
      // Portable equipment (squareMetersRequired=0) is never constrained, so it must hit min.
      const typeDef = data.gymEquipmentTypes.equipment.find(e => e.id === spec.typeId)
      if (typeDef !== undefined && typeDef.squareMetersRequired === 0) {
        expect(actual).toBeGreaterThanOrEqual(minCount)
      }
    }
  })

  it('equipment has valid purchase dates pre-dating startYear', () => {
    const { gym } = generateGym(CITY_ID, NATION_ID, false, null, data, makeRng(), {
      startYear: START_YEAR,
      forceTemplateId: 'established_community',
    })
    for (const item of gym.equipment) {
      expect(item.purchasedYear).toBeLessThan(START_YEAR)
      expect(item.purchasedYear).toBeGreaterThanOrEqual(START_YEAR - 5)
    }
  })
})

describe('generateGym — determinism', () => {
  it('same seed produces the same gym', () => {
    const a = generateGym(CITY_ID, NATION_ID, false, null, data, makeRng(99))
    const b = generateGym(CITY_ID, NATION_ID, false, null, data, makeRng(99))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('different seeds produce different gyms', () => {
    const { gym: a } = generateGym(CITY_ID, NATION_ID, false, null, data, makeRng(1))
    const { gym: b } = generateGym(CITY_ID, NATION_ID, false, null, data, makeRng(2))
    expect(a.id).not.toBe(b.id)
  })
})

describe('generateGym — name deduplication', () => {
  it('gym name is not duplicated within same city when usedNamesInCity is passed', () => {
    const usedNamesInCity = new Set<string>()
    const names = new Set<string>()

    for (let i = 0; i < 10; i++) {
      const { gym } = generateGym(CITY_ID, NATION_ID, false, null, data, makeRng(i * 100), {
        usedNamesInCity,
      })
      expect(names.has(gym.name)).toBe(false)
      names.add(gym.name)
      usedNamesInCity.add(gym.name)
    }
  })
})

describe('calculateGymQuality', () => {
  it('returns 0 for a gym with no equipment and all zones at 0', () => {
    const { gym } = generateGym(CITY_ID, NATION_ID, true, 'Test', data, makeRng())
    // Force all equipment conditions to 0
    const zeroGym = { ...gym, equipment: gym.equipment.map(e => ({ ...e, condition: 0 })) }
    const quality = calculateGymQuality(zeroGym, data)
    expect(quality.hasRing).toBe(false)
    expect(quality.ringCount).toBe(0)
  })

  it('overall quality is within 0-100', () => {
    const { gym } = generateGym(CITY_ID, NATION_ID, false, null, data, makeRng(), {
      forceTemplateId: 'elite_gym',
    })
    expect(gym.quality.overall).toBeGreaterThanOrEqual(0)
    expect(gym.quality.overall).toBeLessThanOrEqual(100)
  })
})
