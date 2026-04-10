// generateGym produces a complete Gym from a starting state template.
// City modifiers from cities.json are applied to rent and affect
// the starting financial state.
//
// Generation order:
// 1. Select template based on city population type and city distribution weights
// 2. Roll physical space — total square meters, zone conditions
// 3. Generate starting equipment from template equipment list
// 4. Calculate starting finances — rent modified by city rentModifier
// 5. Generate gym name from gym-names pool
// 6. Initialise staff as empty — populated separately when persons are assigned
// 7. Initialise quality score from zone conditions and equipment
// 8. Initialise culture at neutral values
// 9. Set kids class as inactive by default

import type { GameData } from '../data/loader.js'
import type { RNG } from '../utils/rng.js'
import type {
  Gym,
  GymZone,
  GymZones,
  GymEquipmentItem,
  GymFinances,
  GymQuality,
  GymCulture,
  GymKidsClass,
  GymReputation,
  GymTier,
} from '../types/gym.js'
import type { GymStartingTemplate } from '../types/data/gym.js'

export interface GymGenerationOptions {
  forceTemplateId?: string         // override template selection — used for player gym
  startYear?: number               // world start year for equipment pre-date calculation
  usedNamesInCity?: Set<string>    // prevents duplicate gym names within the same city
}

// generateId produces a deterministic hex id from the seeded RNG.
// Using the RNG (not Date.now) ensures the same seed always produces the same gym.
function generateId(rng: RNG): string {
  const hex = (n: number): string => Math.floor(n * 0xffffffff).toString(16).padStart(8, '0')
  return `${hex(rng.next())}-${hex(rng.next())}`
}

// rollRange returns a random integer between min and max inclusive.
function rollRange(rng: RNG, range: { min: number; max: number }): number {
  return rng.nextInt(range.min, range.max)
}

// selectTemplate picks a template id using the city's population-based distribution weights.
// Player gyms always start in rundown_community so the player begins from a realistic low point.
function selectTemplate(
  city: { population: string },
  isPlayerGym: boolean,
  gymStartingStates: GameData['nations'][string]['gymStartingStates'],
  options: GymGenerationOptions | undefined,
  rng: RNG,
): GymStartingTemplate {
  if (options?.forceTemplateId !== undefined) {
    const forced = gymStartingStates.templates.find(t => t.id === options.forceTemplateId)
    if (forced === undefined) throw new Error(`Forced template "${options.forceTemplateId}" not found`)
    return forced
  }

  if (isPlayerGym) {
    // Player always starts in the rundown template — this is a design constraint that
    // makes the player's growth arc meaningful. Starting strong has no narrative tension.
    const rundown = gymStartingStates.templates.find(t => t.id === 'rundown_community')
    if (rundown === undefined) throw new Error('rundown_community template not found in gym-starting-states.json')
    return rundown
  }

  const dist = gymStartingStates.cityDistribution[city.population]
  if (dist === undefined) {
    // Unknown population type — default to established_community as a safe middle ground.
    const fallback = gymStartingStates.templates.find(t => t.id === 'established_community')
    return fallback ?? gymStartingStates.templates[0]
  }

  // Convert distribution record to parallel arrays for weightedPick.
  // Zero-weight templates are included but will never be selected — this keeps
  // the data expressive (explicitly 0.00 is more readable than simply omitting the key).
  const ids = Object.keys(dist)
  const weights = ids.map(id => dist[id] ?? 0)
  const selectedId = rng.weightedPick(ids, weights)

  const template = gymStartingStates.templates.find(t => t.id === selectedId)
  if (template === undefined) throw new Error(`Template "${selectedId}" not found in gym-starting-states.json`)
  return template
}

// buildZones allocates square meters and rolls conditions for each zone that exists.
// Zones that do not exist get squareMeters=0 and condition=0 — they cannot be used.
//
// Allocation percentages:
//   training floor: 50% (or 40% when videoAnalysisRoom also exists)
//   strength room:  20%
//   changing rooms: 15%
//   reception:      10%
//   storage:         5% (remaining)
//   videoAnalysisRoom: 10% (carved from training floor allocation)
function buildZones(
  template: GymStartingTemplate,
  totalSqm: number,
  rng: RNG,
): GymZones {
  const tZones = template.zones
  const hasVAR = tZones['videoAnalysisRoom']?.exists === true

  // Training floor loses 10% to the video analysis room when it exists.
  const tfPct = hasVAR ? 0.40 : 0.50

  function makeZone(key: string, pct: number): GymZone {
    const spec = tZones[key]
    if (spec === undefined || !spec.exists) {
      return { exists: false, condition: 0, squareMeters: 0 }
    }
    const condRange = spec.condition
    const condition = typeof condRange === 'object'
      ? rollRange(rng, condRange)
      : 0
    return { exists: true, condition, squareMeters: Math.floor(totalSqm * pct) }
  }

  return {
    trainingFloor: makeZone('trainingFloor', tfPct),
    strengthRoom:  makeZone('strengthRoom', 0.20),
    changingRooms: makeZone('changingRooms', 0.15),
    reception:     makeZone('reception', 0.10),
    ...(tZones['storage']?.exists            ? { storage:          makeZone('storage', 0.05) }           : {}),
    ...(tZones['videoAnalysisRoom']?.exists  ? { videoAnalysisRoom: makeZone('videoAnalysisRoom', 0.10) } : {}),
  }
}

// buildEquipment generates starting equipment items from the template spec.
// Equipment is pre-dated: purchasedYear is 1-5 years before startYear, simulating
// a gym that existed before the player arrived.
//
// Square meter constraint: equipment that would exceed its zone's available space
// is skipped. This prevents tiny gyms from being overstuffed when templates are
// written generously — the physical constraint is the final arbiter.
function buildEquipment(
  template: GymStartingTemplate,
  zones: GymZones,
  data: GameData,
  startYear: number,
  rng: RNG,
): GymEquipmentItem[] {
  // Track used square meters per zone key to enforce capacity limits.
  const usedSqm: Record<string, number> = {}

  const items: GymEquipmentItem[] = []

  for (const spec of template.startingEquipment) {
    const typeDef = data.gymEquipmentTypes.equipment.find(e => e.id === spec.typeId)
    if (typeDef === undefined) continue

    const count = typeof spec.count === 'number'
      ? spec.count
      : rollRange(rng, spec.count)

    const zoneKey = typeDef.zone as keyof GymZones
    const zone = zones[zoneKey] as GymZone | undefined
    const zoneSqm = zone?.squareMeters ?? 0
    const zoneUsed = usedSqm[typeDef.zone] ?? 0

    for (let i = 0; i < count; i++) {
      // Portable equipment (squareMetersRequired=0) is never constrained by space.
      // Fixed equipment is skipped if the zone cannot physically accommodate it.
      if (typeDef.squareMetersRequired > 0) {
        if (zoneUsed + typeDef.squareMetersRequired > zoneSqm) continue
        usedSqm[typeDef.zone] = (usedSqm[typeDef.zone] ?? 0) + typeDef.squareMetersRequired
      }

      const condition = rollRange(rng, spec.condition)
      const yearsAgo = rng.nextInt(1, 5)

      items.push({
        id: generateId(rng),
        typeId: spec.typeId,
        condition,
        purchasedYear: startYear - yearsAgo,
        purchasedWeek: rng.nextInt(1, 52),
        lastMaintenanceYear: null,
        lastMaintenanceWeek: null,
        inUse: condition > 0,
      })
    }
  }

  return items
}

// pickGymName selects a name from the fullNames pool, skipping any already used
// within the same city. Falls back to pattern-based generation when the pool
// is exhausted — cities with many gyms will eventually get pattern names.
function pickGymName(
  nationId: string,
  data: GameData,
  usedNamesInCity: Set<string> | undefined,
  rng: RNG,
): string {
  const bundle = data.nations[nationId]
  const gymNames = bundle?.gymNames

  if (gymNames !== undefined && gymNames.fullNames.length > 0) {
    // Shuffle a copy of the pool and take the first name not already used.
    // Shuffling via repeated picks avoids bias toward names at the front of the array.
    const available = gymNames.fullNames.filter(
      n => usedNamesInCity === undefined || !usedNamesInCity.has(n),
    )
    if (available.length > 0) {
      return rng.pick(available)
    }
  }

  // Pool exhausted or absent — generate from patterns or use a generic fallback.
  if (gymNames !== undefined) {
    const prefix = rng.pick(gymNames.patterns.cityPrefix)
    const suffix = rng.pick(gymNames.patterns.suffixes)
    const generated = `${prefix} ${suffix}`
    if (usedNamesInCity === undefined || !usedNamesInCity.has(generated)) {
      return generated
    }
  }

  // Last resort: a standalone name with a numeric suffix to guarantee uniqueness.
  const standalone = gymNames !== undefined
    ? rng.pick(gymNames.patterns.standalone)
    : 'Boxing Club'
  return `${standalone} ${rng.nextInt(2, 99)}`
}

// ─── calculateGymQuality ─────────────────────────────────────────────────────

// calculateGymQuality derives the current quality scores from zone and equipment state.
// Called after generation and after any equipment condition change or zone update.
// Never stores raw zone/equipment state — always recalculates from current reality.
//
// Zone quality uses equipment condition as the primary signal because equipment
// degrades faster than the zone itself — a gym with broken bags is poor quality
// even if the floor is structurally sound.
// Fallback to zone condition when no equipment exists in a zone (e.g. changing rooms).
export function calculateGymQuality(gym: Gym, data: GameData): GymQuality {
  const hasRing = gym.equipment.some(e => e.typeId === 'boxing_ring' && e.condition > 0)
  const ringCount = gym.equipment.filter(e => e.typeId === 'boxing_ring' && e.condition > 0).length

  // floor(trainingFloor.squareMeters / 4) gives the maximum simultaneous training capacity.
  // The divisor 4 comes from the minimum space standard: each active training slot
  // requires approximately 4 square metres to avoid dangerous crowding on the floor.
  const maxTrainingCapacity = Math.floor(gym.zones.trainingFloor.squareMeters / 4)

  // Group equipment condition values by zone key (matches GymEquipmentTypeDefinition.zone).
  const conditionsByZone = new Map<string, number[]>()
  for (const item of gym.equipment) {
    const typeDef = data.gymEquipmentTypes.equipment.find(e => e.id === item.typeId)
    if (typeDef === undefined) continue
    const existing = conditionsByZone.get(typeDef.zone)
    if (existing !== undefined) {
      existing.push(item.condition)
    } else {
      conditionsByZone.set(typeDef.zone, [item.condition])
    }
  }

  function avgCondition(zoneKey: keyof typeof gym.zones, equipmentZoneKey: string): number {
    const zone = gym.zones[zoneKey] as GymZone | undefined
    if (zone === undefined || !zone.exists) return 0
    const conditions = conditionsByZone.get(equipmentZoneKey)
    if (conditions === undefined || conditions.length === 0) {
      // No equipment in this zone — fall back to the zone's structural condition.
      return zone.condition
    }
    return conditions.reduce((a, b) => a + b, 0) / conditions.length
  }

  const tfQuality  = avgCondition('trainingFloor', 'trainingFloor')
  const srQuality  = avgCondition('strengthRoom',  'strengthRoom')
  const crQuality  = avgCondition('changingRooms', 'changingRooms')
  const recQuality = avgCondition('reception',     'reception')

  // "Other" averages any optional zone quality (storage, video analysis room).
  // These rarely have equipment so the zone condition value is used directly.
  const varZone = gym.zones.videoAnalysisRoom as GymZone | undefined
  const storZone = gym.zones.storage as GymZone | undefined
  const otherSamples: number[] = []
  if (varZone?.exists === true) otherSamples.push(varZone.condition)
  if (storZone?.exists === true) otherSamples.push(storZone.condition)
  const otherQuality = otherSamples.length > 0
    ? otherSamples.reduce((a, b) => a + b, 0) / otherSamples.length
    : 0

  // Weighted composite mirrors the importance of each zone to a boxer's development:
  // training floor dominates because it is where athletes actually train.
  const overall = Math.round(
    tfQuality  * 0.50 +
    srQuality  * 0.20 +
    crQuality  * 0.10 +
    recQuality * 0.10 +
    otherQuality * 0.10,
  )

  return {
    trainingFloor: Math.round(tfQuality),
    strengthRoom:  Math.round(srQuality),
    changingRooms: Math.round(crQuality),
    reception:     Math.round(recQuality),
    overall,
    hasRing,
    ringCount,
    maxTrainingCapacity,
    lastCalculatedYear: 0,
    lastCalculatedWeek: 0,
  }
}

// ─── generateGym ─────────────────────────────────────────────────────────────

export function generateGym(
  cityId: string,
  nationId: string,
  isPlayerGym: boolean,
  gymName: string | null,
  data: GameData,
  rng: RNG,
  options?: GymGenerationOptions,
): Gym {
  const bundle = data.nations[nationId]
  if (bundle === undefined) throw new Error(`Nation "${nationId}" not found in game data`)

  const city = bundle.cities.cities.find(c => c.id === cityId)
  if (city === undefined) throw new Error(`City "${cityId}" not found in nation "${nationId}"`)

  const startYear = options?.startYear ?? 2026

  // Step 1 — Select template.
  const template = selectTemplate(city, isPlayerGym, bundle.gymStartingStates, options, rng)

  // Step 2 — Roll physical space.
  const totalSquareMeters = rollRange(rng, template.squareMeters)
  const zones = buildZones(template, totalSquareMeters, rng)

  // Step 3 — Generate equipment from template spec.
  const equipment = buildEquipment(template, zones, data, startYear, rng)

  // Step 4 — Finances: rent is scaled by the city modifier, reflecting urban cost of living.
  // Harder cities have higher rent, which creates natural difficulty gradient without
  // making certain city choices unviable — the player must weigh revenue against costs.
  const baseRent = rollRange(rng, template.finances.monthlyRent)
  const monthlyRent = Math.round(baseRent * city.rentModifier)
  const balance = rollRange(rng, template.finances.startingBalance)
  const membershipFeeMonthly = rollRange(rng, template.finances.membershipFeeMonthly)

  const finances: GymFinances = {
    monthlyRent,
    balance,
    loanAmount: 0,
    loanRepaymentMonthly: 0,
    membershipFeeMonthly,
    lastUpdatedYear: 0,
    lastUpdatedWeek: 0,
    revenueHistory: [],
  }

  // Step 5 — Gym name.
  const resolvedName = gymName !== null
    ? gymName
    : pickGymName(nationId, data, options?.usedNamesInCity, rng)

  // Step 6 — Locker count (max membership).
  const lockerCount = rollRange(rng, template.lockerCount)

  // Step 7 — Reputation from template ranges.
  function rollRep(key: string): number {
    const val = template.reputation[key]
    if (val === 0 || val === undefined) return 0
    return rollRange(rng, val)
  }

  const reputation: GymReputation = {
    local:         rollRep('local'),
    regional:      rollRep('regional'),
    national:      rollRep('national'),
    international: rollRep('international'),
  }

  // Founded: gyms pre-exist the player. A random window of 5-30 years ensures
  // variety — some are fresh startups, others have decades of history.
  const foundedYear = startYear - rng.nextInt(5, 30)

  // Placeholder gymTier — properly derived from roster composition after members are assigned.
  // Using 'community' as the safe default because all gyms start without a roster.
  const gymTier: GymTier = 'community'

  // Step 8 — Culture: neutral starting values, emerges from real events over time.
  const culture: GymCulture = {
    atmosphereScore:   rng.nextInt(30, 60),
    sparringIntensity: rng.nextInt(30, 60),
    memberCohesion:    rng.nextInt(40, 65),
    coachingFocus:     null,
    reputationTone:    null,
  }

  // Step 9 — Kids class: off by default. Requires deliberate activation and a qualified instructor.
  const kidsClass: GymKidsClass = {
    active: false,
    instructorPersonId: null,
    monthlyFee: 0,
    currentEnrolment: 0,
    maxEnrolment: 0,
    cohortHistory: [],
  }

  const gym: Gym = {
    id: generateId(rng),
    name: resolvedName,
    cityId,
    nationId,
    isPlayerGym,
    foundedYear,
    foundedWeek: 1,
    totalSquareMeters,
    zones,
    equipment,
    pendingOrders: [],
    activeExpansion: null,
    staffMembers: [],
    memberIds: [],
    fighterIds: [],
    finances,
    lockerCount,
    kidsClass,
    quality: {
      trainingFloor: 0,
      strengthRoom: 0,
      changingRooms: 0,
      reception: 0,
      overall: 0,
      hasRing: false,
      ringCount: 0,
      maxTrainingCapacity: 0,
      lastCalculatedYear: 0,
      lastCalculatedWeek: 0,
    },
    gymTier,
    culture,
    reputation,
    accomplishments: [],
  }

  // Step 7 — Calculate quality now that equipment and zones are finalised.
  gym.quality = calculateGymQuality(gym, data)

  return gym
}
