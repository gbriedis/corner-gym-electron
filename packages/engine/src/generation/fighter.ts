// generateFighter creates a complete Fighter from a generated Person.
// A Person becomes a Fighter when the world generation assigns them
// to a gym and determines they have boxing background.
// Not every Person is a Fighter — only those with some boxing history
// or those the world generation identifies as potential competitors.
//
// Generation order:
// 1. Assign boxing background (years training, prior gym, self taught)
// 2. Assign fighter identity state based on background, age, soul traits
// 3. Assign weight class from physical build
// 4. Calculate starting developed attributes from background + soul traits + nation
// 5. Assign starting style tendency from soul traits + physical build
// 6. Assign ambitions from soul traits + reason for boxing
// 7. Assign career state (gym, coach, loyalty, readiness)
// 8. Initialise competition record (empty for new fighters, populated for statistically generated ones)
// 9. Initialise player knowledge (depth 0, nothing revealed)

import type { Person, AttributeValue } from '../types/person.js'
import type {
  Fighter,
  FighterIdentity,
  FighterIdentityState,
  BoxingBackground,
  DevelopedAttribute,
  AttributeHistory,
  FighterStyle,
  StyleTendency,
  AmbitionLevel,
  AmateurCareer,
  ProCareer,
  FighterAmbitions,
  FighterCareerState,
  PlayerKnowledge,
  CompetitionStatus,
  ProTitle,
} from '../types/fighter.js'
import type { WeightClass } from '../types/data/weightClasses.js'
import type { GameData } from '../data/loader.js'
import type { RNG } from '../utils/rng.js'

export interface FighterGenerationOptions {
  // For statistically generated fighters (world pre-generation)
  // who already have career history.
  existingRecord?: {
    amateurWins: number
    amateurLosses: number
    proWins: number
    proLosses: number
    titlesHeld: string[]   // belt ids
  }
  forceIdentityState?: FighterIdentityState
  forceWeightClass?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// traitSet builds a lookup for which soul traits this person holds.
// Used throughout generation to avoid repeated array scans.
function traitSet(person: Person): Set<string> {
  return new Set(person.soulTraits.map(t => t.traitId))
}

// baseValueForYears maps years of training to a starting attribute value
// using linear interpolation between the breakpoints in attribute-accumulation.json.
// Using floor rather than round so interpolated values are conservative —
// 4 years gets the 3-year value, not the 5-year value.
function baseValueForYears(years: number, table: Record<string, number | string>): number {
  const breakpoints = [0, 1, 2, 3, 5, 7, 10]
  const vals = breakpoints.map(bp => {
    const v = table[String(bp)]
    return typeof v === 'number' ? v : 0
  })

  if (years <= 0) return vals[0]
  if (years >= 10) return vals[vals.length - 1]

  for (let i = 0; i < breakpoints.length - 1; i++) {
    if (years >= breakpoints[i] && years <= breakpoints[i + 1]) {
      const t = (years - breakpoints[i]) / (breakpoints[i + 1] - breakpoints[i])
      return Math.floor(vals[i] + t * (vals[i + 1] - vals[i]))
    }
  }

  return vals[0]
}

// assignWeightClass finds the lightest class whose limit covers the fighter's walk-around weight.
// Super heavyweight is excluded — it is amateur-only and cannot be a starting pro class.
// If the fighter's weight exceeds all concrete limits, heavyweight is returned.
function assignWeightClass(
  weightKg: number,
  weightClasses: WeightClass[],
  forceWeightClass: string | undefined,
): string {
  if (forceWeightClass !== undefined) return forceWeightClass

  const sorted = [...weightClasses]
    .filter(wc => !wc.amateurOnly)
    .sort((a, b) => {
      if (a.limitKg === null) return 1   // heavyweight always sorts last
      if (b.limitKg === null) return -1
      return a.limitKg - b.limitKg
    })

  for (const wc of sorted) {
    // null limitKg = heavyweight = no upper bound, accepts any weight
    if (wc.limitKg === null || weightKg <= wc.limitKg) return wc.id
  }

  return 'heavyweight'
}

// calculateStyleEffectiveness returns how well a fighter's current attributes
// support their declared style tendency.
// Returns 0.0 to 1.0 — 1.0 means full style expression, below 1.0 means
// the style is limited by attribute gaps.
// The weakest threshold attribute determines overall effectiveness.
// This is used by the exchange simulation — not stored on the fighter.
// Exported so the fight engine can call it per round as attributes degrade.
export function calculateStyleEffectiveness(
  style: FighterStyle,
  developedAttributes: DevelopedAttribute[],
  physicalAttributes: AttributeValue[],
  data: GameData,
): number {
  // Undefined style means the fighter has no system — pure attribute fight,
  // no style modifiers should be applied at all.
  if (style.currentTendency === 'undefined') return 0

  // A fighter who knows their style but hasn't internalised it yet contributes
  // little style pressure. tendencyStrength is the multiplier for how much style
  // expression actually shows up in a bout.
  if (style.tendencyStrength === 0) return 0

  const thresholds = data.styleMatchups.styleThresholds[style.currentTendency]
  if (thresholds === undefined) return 0

  // For each threshold attribute, find the value from whichever pool holds it
  // (physical attributes live on Person; developed attributes are trained skills).
  // The weakest link determines overall effectiveness — a "boxer" with no footwork
  // is not boxing, regardless of how good their ring_generalship is.
  let minimumEffectiveness = 1.0
  for (const [attributeId, threshold] of Object.entries(thresholds)) {
    const physVal = physicalAttributes.find(a => a.attributeId === attributeId)?.current
    const devVal = developedAttributes.find(d => d.attributeId === attributeId)?.current
    const value = physVal ?? devVal ?? 0

    const effectiveness = Math.min(1.0, value / threshold)
    if (effectiveness < minimumEffectiveness) {
      minimumEffectiveness = effectiveness
    }
  }

  // tendencyStrength scales the final result — even perfect attributes produce reduced
  // style influence when the fighter's style is not yet internalised.
  return minimumEffectiveness * (style.tendencyStrength / 100)
}

// ─── Main generation function ─────────────────────────────────────────────────

export function generateFighter(
  person: Person,
  gymId: string | null,
  coachId: string | null,
  data: GameData,
  rng: RNG,
  options?: FighterGenerationOptions,
): Fighter {
  const traits = traitSet(person)
  const nation = data.nations[person.nationId]
  if (nation === undefined) throw new Error(`Nation "${person.nationId}" not found in game data`)
  const boxingCulture = nation.nation.boxingCulture
  const formula = data.attributeAccumulation.startingValueFormula

  // ─── Step 1: Boxing Background ────────────────────────────────────────────────

  // firstTrainedAge range anchors to boxing culture:
  // High-culture nations have gyms in every district — children encounter boxing early.
  // Low-culture nations lack infrastructure — most fighters come to the sport late.
  let trainedAgeMin: number
  let trainedAgeMax: number
  if (boxingCulture <= 2) { trainedAgeMin = 16; trainedAgeMax = 22 }
  else if (boxingCulture <= 4) { trainedAgeMin = 14; trainedAgeMax = 18 }
  else { trainedAgeMin = 12; trainedAgeMax = 15 }

  // Hungry fighters seek the sport out regardless of culture;
  // content fighters only find boxing if it lands in their lap.
  if (traits.has('hungry')) {
    trainedAgeMin = Math.max(10, trainedAgeMin - 2)
    trainedAgeMax = Math.max(trainedAgeMin + 1, trainedAgeMax - 2)
  }
  if (traits.has('content')) {
    trainedAgeMin += 2
    trainedAgeMax = Math.min(25, trainedAgeMax + 2)
  }

  // firstTrainedAge cannot exceed (age - 1) — person must have been alive before training
  const firstTrainedAge = Math.min(person.age - 1, rng.nextInt(trainedAgeMin, trainedAgeMax))
  const yearsTraining = Math.max(0, person.age - firstTrainedAge)

  // Self-taught probability decreases with boxing culture:
  // In a culture-5 nation, gym access is ubiquitous — being self-taught is rare.
  // In a culture-1 nation, formal coaching is scarce — fighters learn from family or instinct.
  // Linear from 0.40 at culture 1 to 0.05 at culture 5.
  const selfTaughtProb = 0.40 - (boxingCulture - 1) * 0.0875
  const selfTaught = rng.next() < selfTaughtProb

  // Prior gym: eligible if trained >2 years without being self-taught.
  // World gyms don't exist at generation time, so priorGymId is null —
  // but the modifier still applies because the training happened.
  const eligibleForPriorGym = yearsTraining > 2 && !selfTaught
  const hasPriorGym = eligibleForPriorGym && rng.next() < 0.6

  const boxingBackground: BoxingBackground = {
    yearsTraining,
    firstTrainedAge,
    selfTaught,
    priorGymId: null,
    priorGymNationId: hasPriorGym ? person.nationId : null,
  }

  // ─── Step 2: Fighter Identity State ──────────────────────────────────────────

  const existingBouts =
    (options?.existingRecord?.amateurWins ?? 0) +
    (options?.existingRecord?.amateurLosses ?? 0) +
    (options?.existingRecord?.proWins ?? 0) +
    (options?.existingRecord?.proLosses ?? 0)

  let identityState: FighterIdentityState

  if (options?.forceIdentityState !== undefined) {
    identityState = options.forceIdentityState
  } else if (options?.existingRecord !== undefined && existingBouts > 0) {
    // A fighter who has actually competed self-identifies as a competitor,
    // regardless of what their traits would otherwise suggest.
    identityState = 'competing'
  } else {
    const reason = person.reasonForBoxingId

    // High drive: the combination of a survival-oriented reason and hungry ambition
    // makes it nearly certain they have already committed to the sport.
    const highDrive = (reason === 'way_out' || reason === 'prove_something') && traits.has('hungry')

    // Low drive: the combination of a passive reason and content disposition
    // makes competition unlikely — they box for the activity, not the outcome.
    const lowDrive = (reason === 'outlet' || reason === 'fell_into_it' || reason === 'friend_brought_me') && traits.has('content')

    // Older untrained fighters almost never discover competitive boxing on their own.
    const olderUntrained = person.age > 30 && yearsTraining === 0

    if (highDrive && yearsTraining >= 2) {
      // High-drive fighters are committed to competing but haven't competed yet —
      // 'competing' requires actual bout history, which is set above for existingRecord.
      identityState = 'aspiring'
    } else if (lowDrive || olderUntrained) {
      identityState = rng.next() < 0.7 ? 'unaware' : 'curious'
    } else if (yearsTraining === 0) {
      identityState = rng.next() < 0.5 ? 'unaware' : 'curious'
    } else {
      // Middle ground: training years indicate intent but not competition.
      // 'competing' requires actual bout history — cap at 'aspiring' here.
      const roll = rng.next()
      if (roll < 0.2) identityState = 'curious'
      else identityState = 'aspiring'
    }
  }

  const fighterIdentity: FighterIdentity = {
    state: identityState,
    stateChangedYear: 0,
    stateChangedWeek: 0,
  }

  // ─── Step 3: Weight Class ─────────────────────────────────────────────────────

  const weightClassId = assignWeightClass(
    person.physicalProfile.weightKg,
    data.weightClasses.weightClasses,
    options?.forceWeightClass,
  )

  // ─── Step 4: Starting Developed Attributes ────────────────────────────────────

  // Mental attributes require actual bout experience — no fight means no test.
  // A fighter with zero bouts cannot have ring_iq above 3 regardless of training years.
  const mentalIds = new Set(['ring_iq', 'composure', 'adaptability', 'heart', 'big_fight_experience'])

  const mentalCap = (() => {
    const cap = formula.mentalAttributeStartingCap
    if (existingBouts === 0) return cap.noBouts
    if (existingBouts <= 5) return cap.fewBouts_1_to_5
    if (existingBouts <= 20) return cap.experienced_6_to_20
    return cap.veteran_21_plus
  })()

  // Technical = striking + defense categories — these are the attributes shaped by coaching.
  const TECHNICAL_CATEGORIES = new Set(['striking', 'defense'])

  // Technique-proxy attributes: most directly shaped by coaching quality and open-ness
  // to instruction. humble/arrogant modifiers apply here specifically.
  const TECHNIQUE_ATTRS = new Set(['defensive_skill', 'punch_selection', 'combination_fluency'])

  const developedAttributes: DevelopedAttribute[] = data.attributes.attributes.map(attr => {
    const isGiftEligible = attr.scale.generationMax !== undefined
    const hasGift = person.giftsAndFlaws.some(g => g.type === 'gift' && g.appliesTo === attr.id)

    // generationCeiling is the hard cap for this attribute at generation.
    // Gift-eligible without a gift cannot exceed 18 — the gift is the only path to 19-20.
    const generationCeiling = isGiftEligible && !hasGift ? 18 : 20
    const currentPotential = generationCeiling

    let base = baseValueForYears(yearsTraining, formula.baseByYearsTraining)

    // Self-taught fighters lack structured fundamentals — their base is lower across all attributes.
    // Prior gym fighters had early coaching — they start with a stronger foundation.
    const bgMod = formula.backgroundModifiers
    if (selfTaught) base += bgMod.selfTaught
    else if (hasPriorGym) base += bgMod.priorGym

    // Nation cultural modifier: higher boxing culture means better coaching availability,
    // stronger sparring pools, and deeper infrastructure from childhood.
    if (boxingCulture >= 5) base += 1
    else if (boxingCulture <= 2) base -= 1

    // Soul trait modifiers apply only to technical attributes (striking + defense).
    // Physical and mental attributes are not shaped by coaching receptivity at generation.
    if (TECHNICAL_CATEGORIES.has(attr.category)) {
      // Trusting fighters absorb coaching readily; paranoid fighters resist instruction
      // even when it would clearly help them.
      if (traits.has('trusting')) base += 1
      else if (traits.has('paranoid')) base -= 1

      // Humble fighters correct their flaws; arrogant fighters repeat them.
      // This applies most to technique-proxy attributes where ego affects learning.
      if (TECHNIQUE_ATTRS.has(attr.id)) {
        if (traits.has('humble')) base += 1
        else if (traits.has('arrogant')) base -= 1
      }
    }

    let current = Math.max(1, Math.min(generationCeiling, base))

    // Apply mental attribute cap — unbounded mental values at generation would let fighters
    // arrive with composure they have never earned under real fight pressure.
    if (mentalIds.has(attr.id)) {
      current = Math.min(current, mentalCap)
    }

    return { attributeId: attr.id, current, currentPotential, generationCeiling }
  })

  // Attribute history starts empty — events are recorded as the simulation runs.
  // baseValue is set to the generation starting value so the full development arc
  // is preserved from the moment the fighter is created.
  const attributeHistory: AttributeHistory[] = data.attributes.attributes.map(attr => ({
    attributeId: attr.id,
    baseValue: developedAttributes.find(d => d.attributeId === attr.id)?.current ?? 1,
    events: [],
  }))

  // ─── Step 5: Style Tendency ───────────────────────────────────────────────────

  // ~12% of fighters are southpaw — matches the real-world distribution.
  const southpaw = rng.next() < 0.12

  let style: FighterStyle
  if (yearsTraining < 2) {
    // Too early for a defined style — still learning basic mechanics, not expressing tendencies.
    style = { currentTendency: 'undefined', tendencyStrength: 0, southpaw }
  } else {
    // Genetic attribute values (from Person) signal what this body is built for.
    // The developed values signal what techniques have been practised.
    const powerAttr = person.attributes.find(a => a.attributeId === 'power')?.current ?? 5
    const footworkAttr = person.attributes.find(a => a.attributeId === 'footwork')?.current ?? 5
    const comboAttr = developedAttributes.find(d => d.attributeId === 'combination_fluency')?.current ?? 1
    const counterAttr = developedAttributes.find(d => d.attributeId === 'counter_punching')?.current ?? 1

    // Style candidates are weighted possibilities — multiple can qualify,
    // and the RNG picks among them. This is intentional: a brave fighter with
    // good power could lean toward pressure or swarmer depending on the rest of their traits.
    const candidates: Array<{ tendency: StyleTendency; weight: number }> = []

    if (traits.has('brave') && powerAttr >= 12) candidates.push({ tendency: 'pressure', weight: 3 })
    if (traits.has('patient') && footworkAttr >= 10) candidates.push({ tendency: 'boxer', weight: 3 })
    if (traits.has('hungry') && comboAttr >= 4) candidates.push({ tendency: 'boxer_puncher', weight: 2 })
    if (traits.has('reckless') && powerAttr >= 12) candidates.push({ tendency: 'brawler', weight: 3 })
    if (traits.has('patient') && counterAttr >= 3) candidates.push({ tendency: 'counterpuncher', weight: 2 })
    if (traits.has('hungry') && traits.has('brave')) candidates.push({ tendency: 'swarmer', weight: 1 })

    const currentTendency: StyleTendency = candidates.length > 0
      ? rng.weightedPick(candidates, candidates.map(c => c.weight)).tendency
      : 'undefined'

    // Tendency starts weak — styles solidify through training and fighting, not at generation.
    const tendencyStrength = rng.nextInt(10, 30)
    style = { currentTendency, tendencyStrength, southpaw }
  }

  // ─── Step 6: Ambitions ────────────────────────────────────────────────────────

  const reason = person.reasonForBoxingId
  let ambitionLevel: AmbitionLevel

  if (reason === 'way_out' && traits.has('hungry')) {
    // Survival-motivated fighters with drive aim as high as the sport goes.
    ambitionLevel = rng.next() < 0.5 ? 'world_title' : 'undisputed'
  } else if (reason === 'prove_something' && traits.has('brave')) {
    // Proving yourself to a specific audience rarely requires world titles —
    // national or international recognition is usually enough.
    ambitionLevel = rng.next() < 0.5 ? 'national' : 'international'
  } else if (reason === 'passion') {
    // Passion-driven fighters chase excellence for its own sake.
    // Patient and determined personalities think in Olympic cycles; others in domestic results.
    ambitionLevel = (traits.has('patient') || traits.has('determined')) ? 'olympic' : 'national'
  } else if ((reason === 'outlet' || reason === 'fell_into_it' || reason === 'friend_brought_me') && traits.has('content')) {
    // Low-drive origin + content disposition = boxing as hobby, not career.
    ambitionLevel = rng.next() < 0.5 ? 'local' : 'undecided'
  } else if (reason === 'fell_into_it' || reason === 'friend_brought_me') {
    // Accidental boxers who didn't drift away rarely have strong targets yet.
    ambitionLevel = 'undecided'
  } else if (traits.has('hungry')) {
    // Hungry fighters with other origins still aim high — drive outweighs circumstance.
    ambitionLevel = rng.next() < 0.4 ? 'national' : 'international'
  } else {
    ambitionLevel = rng.next() < 0.5 ? 'local' : 'national'
  }

  // Timeframe is shaped by disposition: urgent fighters need results soon,
  // patient fighters trust the long road.
  const timeframe = traits.has('hungry') || traits.has('impatient') ? 'urgent' : 'patient'

  const ambitions: FighterAmbitions = {
    level: ambitionLevel,
    goalCircuitLevel: null,
    timeframe,
    proBeltTarget: null,
  }

  // ─── Step 7: Career State ─────────────────────────────────────────────────────

  // Coachability starts from soul traits alone — the coach relationship hasn't formed yet.
  // It shifts as the actual coach-fighter relationship develops over weeks and bouts.
  let coachabilityBase: number
  if (traits.has('trusting')) coachabilityBase = rng.nextInt(70, 85)
  else if (traits.has('paranoid')) coachabilityBase = rng.nextInt(30, 50)
  else coachabilityBase = rng.nextInt(50, 65)

  if (traits.has('humble')) coachabilityBase = Math.min(100, coachabilityBase + 10)
  if (traits.has('arrogant')) coachabilityBase = Math.max(0, coachabilityBase - 15)

  // Readiness reflects how close this fighter is to competing right now.
  // The engine never surfaces this as a raw number — it becomes scout reports and assessments.
  let readiness: number
  if (identityState === 'competing') readiness = rng.nextInt(60, 80)
  else if (identityState === 'aspiring') readiness = rng.nextInt(40, 60)
  else readiness = rng.nextInt(10, 30)

  const career: FighterCareerState = {
    currentGymId: gymId,
    gymJoinedYear: gymId !== null ? 0 : null,
    gymJoinedWeek: gymId !== null ? 0 : null,
    coachId,
    ambitions,
    stagnationState: 'developing',
    loyaltyScore: gymId !== null ? rng.nextInt(40, 70) : 0,
    coachabilityScore: coachabilityBase,
    readiness,
    lastBoutYear: null,
    lastBoutWeek: null,
    coachingHistory: [],
    peakCircuitLevel: null,
  }

  // ─── Step 8: Competition Record ───────────────────────────────────────────────

  const proWins = options?.existingRecord?.proWins ?? 0
  const proLosses = options?.existingRecord?.proLosses ?? 0
  const amateurWins = options?.existingRecord?.amateurWins ?? 0
  const amateurLosses = options?.existingRecord?.amateurLosses ?? 0
  const titlesHeld = options?.existingRecord?.titlesHeld ?? []

  const isPro = proWins > 0 || proLosses > 0 || titlesHeld.length > 0
  const hasAmateur = amateurWins > 0 || amateurLosses > 0

  let competitionStatus: CompetitionStatus = 'unregistered'
  if (isPro) competitionStatus = 'pro'
  else if (hasAmateur) competitionStatus = 'amateur'

  const amateurCareer: AmateurCareer = {
    wins: amateurWins,
    losses: amateurLosses,
    boutIds: [],
    currentLosingStreak: 0,
    titles: [],
    medals: [],
    rankings: [],
    registeredWithBodyId: null,
  }

  const proTitles: ProTitle[] = titlesHeld.map(beltId => ({
    beltId,
    sanctioningBodyId: '',
    weightClassId,
    wonYear: 0,
    wonWeek: 0,
    defences: 0,
    active: true,
  }))

  const proCareer: ProCareer = {
    wins: proWins,
    losses: proLosses,
    draws: 0,
    knockouts: 0,
    boutIds: [],
    titles: proTitles,
    rankings: [],
    promoterId: null,
    contractStartYear: null,
    contractStartWeek: null,
    contractEndYear: null,
    contractEndWeek: null,
    activeClauses: [],
    managerId: null,
  }

  // ─── Step 9: Player Knowledge ─────────────────────────────────────────────────

  // The player knows nothing about this fighter at generation.
  // Knowledge is built through scouting, interactions, and observed bouts over time.
  const playerKnowledge: PlayerKnowledge = {
    depthLevel: 0,
    revealedSoulTraits: [],
    revealedPhysicalGifts: [],
    revealedFlaws: [],
    firstMetYear: null,
    firstMetWeek: null,
    lastInteractionYear: null,
    lastInteractionWeek: null,
    notes: [],
  }

  return {
    ...person,
    fighterIdentity,
    boxingBackground,
    developedAttributes,
    attributeHistory,
    style,
    competition: {
      status: competitionStatus,
      weightClassId,
      amateur: amateurCareer,
      pro: proCareer,
    },
    career,
    playerKnowledge,
  }
}
