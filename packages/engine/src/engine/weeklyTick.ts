// weeklyTick handles all non-event updates that happen every week:
// equipment decay, gym finances, and fighter inactivity regression.
//
// These run regardless of whether there are events scheduled this week.
// Without this the world would be static between fights — equipment
// would never wear out and fighters who stop competing would stay sharp forever.

import type { AdvanceWeekState } from '../types/advanceWeek.js'
import type { GameData } from '../data/loader.js'
import type { RNG } from '../utils/rng.js'
import type { AttributeHistoryEvent } from '../types/fighter.js'

// WEEKS_PER_MONTH is used to convert monthly financial figures to weekly.
// Real months vary but 4 weeks/month is the simulation's approximation.
const WEEKS_PER_MONTH = 4

// Attribute categories derived from the JSON data at runtime.
// Inactivity regression rates are keyed by these three buckets.
// "technical" covers striking + defense, "mental" is mental, "physical" is physical.
function buildAttributeCategories(data: GameData): {
  technical: Set<string>
  mental: Set<string>
  physical: Set<string>
  physicalGenetic: Set<string>
} {
  const technical = new Set<string>()
  const mental = new Set<string>()
  const physical = new Set<string>()

  for (const attr of data.attributes.attributes) {
    if (attr.category === 'striking' || attr.category === 'defense') {
      technical.add(attr.id)
    } else if (attr.category === 'mental') {
      mental.add(attr.id)
    } else if (attr.category === 'physical') {
      physical.add(attr.id)
    }
  }

  // Physical genetic attributes are those listed in physicalGeneticRegression.ratePerYear.
  // These decay with age — separate from inactivity regression.
  const physicalGenetic = new Set<string>(
    Object.keys(data.attributeAccumulation.inactivityRegression.physicalGeneticRegression.ratePerYear),
  )

  return { technical, mental, physical, physicalGenetic }
}

// decayEquipment reduces each equipment item's condition by its type's weekly decay rate,
// then auto-maintains any item that falls below condition 25.
//
// Auto-maintenance is intentionally limited by gym finances. A struggling gym that
// cannot afford repairs runs degraded equipment — this is the simulation's consequence
// for financial mismanagement, not a bug to be papered over.
//
// Repair cost = 15% of purchase cost. Condition restored to 75 (not 100) because
// a quick repair doesn't fully restore old equipment.
function decayEquipment(state: AdvanceWeekState, data: GameData): void {
  // Build lookup maps from equipment typeId.
  const decayByType = new Map<string, number>()
  const costByType = new Map<string, number>()
  for (const eqType of data.gymEquipmentTypes.equipment) {
    decayByType.set(eqType.id, eqType.conditionDecayPerWeek)
    costByType.set(eqType.id, eqType.purchaseCost)
  }

  for (const [gymId, gym] of state.gyms) {
    let changed = false
    for (const item of gym.equipment) {
      const decay = decayByType.get(item.typeId) ?? 0
      if (decay > 0) {
        item.condition = Math.max(0, item.condition - decay)
        changed = true
      }

      // Auto-maintain degraded equipment when the gym can afford it.
      if (item.condition < 25 && item.inUse) {
        const purchaseCost = costByType.get(item.typeId) ?? 0
        const repairCost = purchaseCost * 0.15
        if (repairCost > 0 && gym.finances.balance >= repairCost) {
          item.condition = Math.min(75, item.condition + 50)
          item.lastMaintenanceYear = state.year
          item.lastMaintenanceWeek = state.week
          gym.finances.balance -= repairCost
          changed = true
        }
      }
    }

    // Monthly maintenance fee (every 4 weeks) for all in-use equipment.
    // A gym with more equipment pays more to keep it operational.
    if (state.week % WEEKS_PER_MONTH === 0) {
      const monthlyCost = gym.equipment
        .filter(e => e.inUse && e.condition > 0)
        .reduce((sum, item) => {
          const typeId = item.typeId
          const eqType = data.gymEquipmentTypes.equipment.find(t => t.id === typeId)
          return sum + (eqType?.maintenanceCostMonthly ?? 0)
        }, 0)
      if (monthlyCost > 0) {
        gym.finances.balance -= monthlyCost
        changed = true
      }
    }

    if (changed) {
      state.pendingGymUpdates.add(gymId)
    }
  }
}

// updateGymFinances computes weekly income and outgoings for every gym.
// Income = ((casualMemberCount + fighterIds.length) × monthlyMembershipFee) / 4
// Outgoings = (monthlyRent + totalStaffWages) / 4
// A revenue record is added to revenueHistory once per month (every 4 weeks).
//
// Uses casualMemberCount (non-competing fitness members) + active fighters.
// The old memberIds array is no longer the membership source of truth.
function updateGymFinances(state: AdvanceWeekState): void {
  for (const [gymId, gym] of state.gyms) {
    const totalMembers = gym.casualMemberCount + gym.fighterIds.length

    const weeklyIncome = (totalMembers * gym.finances.membershipFeeMonthly) / WEEKS_PER_MONTH

    const totalStaffWages = gym.staffMembers.reduce(
      (sum, staff) => sum + staff.wageMonthly,
      0,
    )
    const weeklyOutgoings =
      (gym.finances.monthlyRent + totalStaffWages) / WEEKS_PER_MONTH

    gym.finances.balance += weeklyIncome - weeklyOutgoings
    gym.finances.lastUpdatedYear = state.year
    gym.finances.lastUpdatedWeek = state.week

    // Record monthly revenue snapshot every 4 weeks for trend analysis.
    if (state.week % WEEKS_PER_MONTH === 0) {
      gym.finances.revenueHistory.push({
        year: state.year,
        week: state.week,
        income: weeklyIncome * WEEKS_PER_MONTH,
        outgoings: weeklyOutgoings * WEEKS_PER_MONTH,
        balance: gym.finances.balance,
        note: 'monthly summary',
      })
    }

    state.pendingGymUpdates.add(gymId)
  }
}

// applyInactivityRegression regresses a fighter's attributes when they haven't
// competed recently. The regression rate depends on their competition status —
// amateur regression starts earlier and hits harder than pro regression,
// because amateur fighters train less consistently without the financial pressure
// of a professional career keeping them in the gym.
function applyInactivityRegression(
  state: AdvanceWeekState,
  data: GameData,
  attributeCategories: ReturnType<typeof buildAttributeCategories>,
): void {
  const { inactivityRegression } = data.attributeAccumulation
  const { technical, mental, physical } = attributeCategories

  for (const [fighterId, fighter] of state.fighters) {
    const { state: identityState } = fighter.fighterIdentity
    if (identityState !== 'aspiring' && identityState !== 'competing') continue

    // Determine inactivity thresholds for this fighter's status.
    // Amateur and pro have different regressionStartsWeeks — pros have more
    // conditioning discipline and support keeping them sharp longer.
    const status = fighter.competition.status
    const regressionData =
      status === 'pro' ? inactivityRegression.pro : inactivityRegression.amateur

    const { lastBoutYear, lastBoutWeek } = fighter.career
    let weeksSinceLastBout: number

    if (lastBoutYear === null || lastBoutWeek === null) {
      // Fighter has never competed — skip inactivity regression entirely.
      // Inactivity regression represents de-training after an active career.
      // A fighter who has never fought has no peak to decline from — applying
      // regression to them would regress their attributes to floor before they
      // ever enter their first bout, making the world's competing pool look like
      // it started at 1 across all mental and technical attributes.
      continue
    } else {
      weeksSinceLastBout =
        (state.year - lastBoutYear) * 52 + (state.week - lastBoutWeek)
    }

    if (weeksSinceLastBout < regressionData.regressionStartsWeeks) continue

    const { ratePerWeek } = regressionData
    const attributeEvents: AttributeHistoryEvent[] = []

    for (const attr of fighter.developedAttributes) {
      let rate = 0
      if (technical.has(attr.attributeId))    rate = ratePerWeek.technical
      else if (mental.has(attr.attributeId))  rate = ratePerWeek.mental
      else if (physical.has(attr.attributeId)) rate = ratePerWeek.physical_non_genetic

      if (rate <= 0 || attr.current <= 1) continue

      const delta = -rate
      attr.current = Math.max(1, attr.current + delta)

      attributeEvents.push({
        attributeId: attr.attributeId,
        year: state.year,
        week: state.week,
        trigger: 'inactivity',
        delta,
      })
    }

    if (attributeEvents.length > 0) {
      // Merge into pending attribute events map for batch write at year end.
      const existing = state.pendingAttributeEvents.get(fighterId) ?? []
      state.pendingAttributeEvents.set(fighterId, [...existing, ...attributeEvents])
      state.pendingFighterUpdates.add(fighterId)
    }
  }
}

// advancePersonAges increments every fighter's age and applies physical genetic
// regression for fighters over the baseline start age.
// Called once per year when week rolls from 52 to 1.
export function advancePersonAges(state: AdvanceWeekState, data: GameData): void {
  const { physicalGeneticRegression } = data.attributeAccumulation.inactivityRegression
  const { baselineStartAge, ratePerYear } = physicalGeneticRegression

  for (const [, person] of state.persons) {
    person.age += 1
  }

  for (const [fighterId, fighter] of state.fighters) {
    fighter.age += 1

    // Physical genetic regression applies once each year to fighters old enough
    // to have passed their physical prime. The baseline is modifiable by development
    // profile — early bloomers fade sooner, late bloomers hold their peak longer.
    if (fighter.age < baselineStartAge) continue

    const attributeEvents: AttributeHistoryEvent[] = []

    for (const attr of fighter.developedAttributes) {
      const annualRate = ratePerYear[attr.attributeId]
      if (annualRate === undefined || annualRate <= 0) continue
      if (attr.current <= 1) continue

      const delta = -annualRate
      attr.current = Math.max(1, attr.current + delta)

      attributeEvents.push({
        attributeId: attr.attributeId,
        year: state.year,
        week: state.week,
        trigger: 'age_regression',
        delta,
      })
    }

    if (attributeEvents.length > 0) {
      const existing = state.pendingAttributeEvents.get(fighterId) ?? []
      state.pendingAttributeEvents.set(fighterId, [...existing, ...attributeEvents])
      state.pendingFighterUpdates.add(fighterId)
    }
  }
}

// runWeeklyTick applies all background world updates for one week.
// Equipment decays, gym finances move, and inactive fighters regress.
// Returns void — state is mutated in place.
export function runWeeklyTick(state: AdvanceWeekState, data: GameData, _rng: RNG): void {
  const attributeCategories = buildAttributeCategories(data)
  decayEquipment(state, data)
  updateGymFinances(state)
  applyInactivityRegression(state, data, attributeCategories)
}
