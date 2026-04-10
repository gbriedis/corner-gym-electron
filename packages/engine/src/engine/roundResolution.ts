// roundResolution calculates what happens in a single round.
// Called per round by resolveBout until stoppage or scheduled rounds complete.
//
// The round produces:
// - A dominance score (-1.0 to 1.0) reflecting who controlled the round
// - Damage dealt to each fighter
// - Knockdown events if any
// - Stoppage if conditions are met
// - Updated stamina for both fighters
//
// Soul traits affect in-fight behavior:
// - brave: knockdown recovery probability +20%
// - craven: when hurt (taking dominant damage), output drops 30%, stoppage probability increases
// - determined: if losing on cards after round 6, output +15%
// - fragile: after a bad round (dominance < -0.5 for this fighter), next round composure -20%
// - hungry: in title fights and above (circuitLevel contains 'title' or 'olympic'), output +10%
// - content: when ahead by 3+ rounds, output -10% (unconscious easing off)
// - reckless: output +15% but defensive gaps +20% — high variance
// - patient: when behind on cards, does NOT panic — maintains game plan (prevents composure drop)

import type { RNG } from '../utils/rng.js'
import type { GameData } from '../data/loader.js'
import type { RoundScore } from '../types/resolution.js'
import type { FighterBoutState, BoutConditions } from './boutAssessment.js'
import type { Fighter } from '../types/fighter.js'

export interface RoundInput {
  roundNumber: number
  fighterAState: FighterBoutState
  fighterBState: FighterBoutState
  conditions: BoutConditions
  fighterAStamina: number      // current stamina at start of this round
  fighterBStamina: number
  fighterAKnockdowns: number   // cumulative knockdowns this bout
  fighterBKnockdowns: number
  fighterARoundsWon: number    // for soul trait adjustments (determined, content)
  fighterBRoundsWon: number
  // Previous round dominance for each fighter (positive = that fighter won the round).
  // Used for fragile trait: after a bad round, next round composure penalty.
  prevRoundDominanceForA: number
  prevRoundDominanceForB: number
  rng: RNG
  data: GameData
}

export interface RoundResult {
  roundScore: RoundScore
  fighterAStaminaEnd: number
  fighterBStaminaEnd: number
  fighterADamageThisRound: number
  fighterBDamageThisRound: number
}

// getAttr looks up an attribute value from both pools on a fighter.
// Physical attributes (power, chin, etc.) and developed attributes share the same lookup.
function getAttr(fighter: Fighter, id: string): number {
  const dev = fighter.developedAttributes.find(a => a.attributeId === id)
  if (dev !== undefined) return dev.current
  const phys = fighter.attributes.find(a => a.attributeId === id)
  return phys?.current ?? 0
}

function hasTrait(fighter: Fighter, traitId: string): boolean {
  return fighter.soulTraits.some(t => t.traitId === traitId)
}

// computeBaseScore produces the raw attribute-weighted score for a fighter.
// The weights reflect which attributes matter most in a typical round:
// ring generalship controls position and pace — it is the highest contributor.
// technique and defensive skill together determine whether clean punches land.
// power and hand speed determine damage per landed shot.
// output volume determines how often punches are thrown.
// ring IQ is the smallest contributor — it matters but does not dominate.
function computeBaseScore(fighter: Fighter): number {
  return (
    getAttr(fighter, 'ring_generalship') * 0.20 +
    getAttr(fighter, 'punch_accuracy')   * 0.15 +
    getAttr(fighter, 'punch_selection')  * 0.15 +
    getAttr(fighter, 'defensive_skill')  * 0.15 +
    getAttr(fighter, 'power')            * 0.10 +
    getAttr(fighter, 'hand_speed')       * 0.10 +
    getAttr(fighter, 'output_volume')    * 0.10 +
    getAttr(fighter, 'ring_iq')          * 0.05
  )
}

// computeOutputVolumeContribution isolates the output_volume term so stamina effects
// can be applied selectively to it without disturbing other contributions.
function computeOutputVolumeContribution(fighter: Fighter): number {
  return getAttr(fighter, 'output_volume') * 0.10
}

// computeSoulModifiersForOutput returns a multiplier for a fighter's effective output.
// These are additive adjustments — each active trait adds or subtracts from 1.0.
// Multiple traits stack (e.g., reckless + content = 1.15 - 0.10 = net 1.05).
function computeSoulOutputModifier(
  fighter: Fighter,
  isLosing: boolean,
  isAheadByThreePlus: boolean,
  isTitleFight: boolean,
  isHurt: boolean,
  roundNumber: number,
): number {
  let mod = 1.0

  // reckless: output higher but costs energy — the +15% is not free.
  if (hasTrait(fighter, 'reckless')) mod += 0.15

  // determined: only kicks in after round 6 when losing on cards.
  // Represents digging deep when behind — the fighter finds another gear late.
  if (hasTrait(fighter, 'determined') && isLosing && roundNumber > 6) mod += 0.15

  // hungry: in high-stakes bouts the edge sharpens. Only title or Olympic level.
  if (hasTrait(fighter, 'hungry') && isTitleFight) mod += 0.10

  // content: unconsciously easing off when comfortable. The lead becomes a liability.
  if (hasTrait(fighter, 'content') && isAheadByThreePlus) mod -= 0.10

  // craven: when taking punishment, output drops as the fighter prioritises survival.
  if (hasTrait(fighter, 'craven') && isHurt) mod -= 0.30

  return mod
}

// computeSoulDefenseModifier returns a multiplier for how well the fighter defends.
// reckless fighters leave gaps; patient fighters don't panic when behind.
function computeSoulDefenseModifier(
  fighter: Fighter,
  isLosing: boolean,
  prevRoundDominance: number,
): number {
  let mod = 1.0

  // reckless: trading defense for offense — gaps emerge in the attack flurry.
  if (hasTrait(fighter, 'reckless')) mod -= 0.20

  // fragile: after a bad round, composure suffers — defense becomes ragged.
  // The fighter cannot reset mentally after a dominant round from the opponent.
  if (hasTrait(fighter, 'fragile') && prevRoundDominance < -0.5) mod -= 0.20

  // patient: when behind, maintains game plan instead of panicking.
  // Prevents the defensive collapse that craven or fragile fighters suffer.
  if (hasTrait(fighter, 'patient') && isLosing) mod += 0.10

  return mod
}

// computeStaminaDepletion calculates how much stamina this fighter burns in a round.
// Base depletion is 8 points per 3-minute round.
// Longer rounds deplete more; high output volume depletes faster.
// Disciplined fighters use energy efficiently; reckless fighters burn too much.
function computeStaminaDepletion(fighter: Fighter, roundDurationMinutes: number): number {
  const durationScale = roundDurationMinutes / 3.0
  const outputVolume = getAttr(fighter, 'output_volume')
  // Output multiplier: average output (10) = 1.0x; max output (20) ≈ 1.25x.
  const outputMultiplier = 1 + Math.max(0, outputVolume - 10) / 40

  let soulMultiplier = 1.0
  if (hasTrait(fighter, 'disciplined')) soulMultiplier *= 0.85
  if (hasTrait(fighter, 'reckless')) soulMultiplier *= 1.20

  return 8 * durationScale * outputMultiplier * soulMultiplier
}

// computeKnockdownProbability returns the probability a knockdown occurs given
// the raw damage a fighter just absorbed.
// chinThreshold = chin_attribute × health modifier × 2.
// The ×2 factor gives cushion: at average chin (10) and no damage, the threshold
// is 20 — meaning a dominant-but-not-overwhelming round (damage ~14) won't floor
// an average-chinned fighter. Only exceptional dominance or a damaged chin
// pushes the probability meaningfully.
function computeKnockdownProbability(
  fighter: Fighter,
  chinHealthModifier: number,
  rawDamage: number,
): number {
  const chinAttr = getAttr(fighter, 'chin')
  const chinThreshold = chinAttr * chinHealthModifier * 2
  if (chinThreshold <= 0) return 1.0
  const prob = (rawDamage - chinThreshold) / chinThreshold
  return Math.max(0, Math.min(1, prob))
}

// computeStyleAdvantage returns a small score adjustment for fighter A
// based on the style matchup's exchange initiation and distance control advantages.
// Positive = A has style advantage, negative = B has advantage.
// The statistical engine uses a simplified single value — the narrative layer
// will later use the full effectiveModifiers map.
function computeStyleAdvantageForA(
  effectiveModifiers: Record<string, number>,
  matchupSideA: 'styleA' | 'styleB',
): number {
  const modifierSum = Object.values(effectiveModifiers).reduce((a, b) => a + b, 0)
  // matchupSideA determines whether the computed modifier sum benefits A or B.
  return matchupSideA === 'styleA' ? modifierSum * 0.5 : -modifierSum * 0.5
}

export function resolveRound(input: RoundInput): RoundResult {
  const { fighterAState, fighterBState, conditions, rng } = input
  const fA = fighterAState.fighter
  const fB = fighterBState.fighter

  const isTitleFight = input.conditions.rules.circuitLevel.includes('title')
    || input.conditions.rules.circuitLevel.includes('olympic')

  // ─── Round dominance ─────────────────────────────────────────────────────────

  let baseA = computeBaseScore(fA)
  let baseB = computeBaseScore(fB)

  // Stamina effects on output volume contribution.
  // Below 50%: output contribution scales down proportionally.
  // Below 25%: output contribution halved (on top of proportional reduction).
  const staminaA = input.fighterAStamina
  const staminaB = input.fighterBStamina

  const outputContribA = computeOutputVolumeContribution(fA)
  const outputContribB = computeOutputVolumeContribution(fB)

  let staminaOutputModA = 1.0
  let staminaOutputModB = 1.0
  if (staminaA < 25) staminaOutputModA = 0.5
  else if (staminaA < 50) staminaOutputModA = staminaA / 50

  if (staminaB < 25) staminaOutputModB = 0.5
  else if (staminaB < 50) staminaOutputModB = staminaB / 50

  // Replace output contribution with stamina-adjusted version
  baseA = baseA - outputContribA + (outputContribA * staminaOutputModA)
  baseB = baseB - outputContribB + (outputContribB * staminaOutputModB)

  // Health modifiers on the output side (sore hands reduce punch output)
  const handModA = fighterAState.healthModifiers.handOutputModifier
  const handModB = fighterBState.healthModifiers.handOutputModifier
  baseA = baseA - outputContribA * staminaOutputModA + (outputContribA * staminaOutputModA * handModA)
  baseB = baseB - outputContribB * staminaOutputModB + (outputContribB * staminaOutputModB * handModB)

  // Soul modifier for output
  const isALosing = input.fighterARoundsWon < input.fighterBRoundsWon
  const isBLosing = input.fighterBRoundsWon < input.fighterARoundsWon
  const isAheadByThreePlusA = (input.fighterARoundsWon - input.fighterBRoundsWon) >= 3
  const isAheadByThreePlusB = (input.fighterBRoundsWon - input.fighterARoundsWon) >= 3

  // "Hurt" = the fighter has been absorbing dominant damage — approximate from rounds lost
  const isAHurt = input.fighterARoundsWon === 0 && input.roundNumber > 2
  const isBHurt = input.fighterBRoundsWon === 0 && input.roundNumber > 2

  const soulOutputModA = computeSoulOutputModifier(
    fA, isALosing, isAheadByThreePlusA, isTitleFight, isAHurt, input.roundNumber,
  )
  const soulOutputModB = computeSoulOutputModifier(
    fB, isBLosing, isAheadByThreePlusB, isTitleFight, isBHurt, input.roundNumber,
  )

  // Apply output soul modifier to the output_volume contribution portion
  const adjustedOutputContribA = outputContribA * staminaOutputModA * handModA * soulOutputModA
  const adjustedOutputContribB = outputContribB * staminaOutputModB * handModB * soulOutputModB
  baseA = baseA - (outputContribA * staminaOutputModA * handModA) + adjustedOutputContribA
  baseB = baseB - (outputContribB * staminaOutputModB * handModB) + adjustedOutputContribB

  // Soul modifier for defense — affects how effectively the fighter avoids being hit
  const soulDefModA = computeSoulDefenseModifier(fA, isALosing, input.prevRoundDominanceForA)
  const soulDefModB = computeSoulDefenseModifier(fB, isBLosing, input.prevRoundDominanceForB)

  // Defense contribution to the base score (defensive_skill + counter_punching components)
  const defenseContribA = getAttr(fA, 'defensive_skill') * 0.15
  const defenseContribB = getAttr(fB, 'defensive_skill') * 0.15
  baseA = baseA - defenseContribA + (defenseContribA * soulDefModA)
  baseB = baseB - defenseContribB + (defenseContribB * soulDefModB)

  // Style advantage — small modifier from matchup dynamics
  const styleAdv = computeStyleAdvantageForA(conditions.effectiveModifiers, conditions.matchupSideA)
  baseA += styleAdv
  baseB -= styleAdv

  // Normalise to dominance in -1.0 to 1.0 range.
  // Max possible attribute score = 20 (all attributes at 20, weights sum to 1).
  // Using 20 as divisor gives headroom for soul/style boosts to push beyond base range.
  const rawDominance = (baseA - baseB) / 20
  const dominance = Math.max(-1.0, Math.min(1.0, rawDominance))

  // ─── Damage calculation ───────────────────────────────────────────────────────

  // Damage scales with dominance magnitude × effective damage multiplier of the
  // receiving fighter. 40 is the normalisation constant so full dominance (1.0)
  // produces meaningful knockdown probability while partial dominance (~0.35) does not.
  const rawDamageToB = Math.max(0, dominance) * 40 * fighterBState.effectiveDamageMultiplier
  const rawDamageToA = Math.max(0, -dominance) * 40 * fighterAState.effectiveDamageMultiplier
  const damageToB = rawDamageToB * fighterBState.healthModifiers.chinModifier
  const damageToA = rawDamageToA * fighterAState.healthModifiers.chinModifier

  // ─── Knockdown check ──────────────────────────────────────────────────────────

  let knockdownsThisRoundA = 0
  let knockdownsThisRoundB = 0
  let stoppageOccurred = false
  let stoppageReason: RoundScore['stoppageReason']
  let stoppageFighterId: string | undefined

  const checkKnockdown = (
    defender: Fighter,
    defenderState: FighterBoutState,
    damageDealt: number,
  ): boolean => {
    const prob = computeKnockdownProbability(
      defender,
      defenderState.healthModifiers.chinModifier,
      damageDealt,
    )
    if (prob <= 0) return false
    const roll = rng.next()
    return roll < prob
  }

  // Check knockdown for B (A is dominating)
  if (dominance > 0) {
    const knocked = checkKnockdown(fB, fighterBState, damageToB)
    if (knocked) {
      knockdownsThisRoundB++
    }
  }
  // Check knockdown for A (B is dominating)
  if (dominance < 0) {
    const knocked = checkKnockdown(fA, fighterAState, damageToA)
    if (knocked) {
      knockdownsThisRoundA++
    }
  }

  const totalKnockdownsA = input.fighterAKnockdowns + knockdownsThisRoundA
  const totalKnockdownsB = input.fighterBKnockdowns + knockdownsThisRoundB

  // Three knockdown rule check — if enabled and a fighter reaches 3 cumulative knockdowns
  if (conditions.threeKnockdownRule) {
    if (totalKnockdownsB >= 3) {
      stoppageOccurred = true
      stoppageReason = 'three_knockdown_rule'
      stoppageFighterId = fB.id
    } else if (totalKnockdownsA >= 3) {
      stoppageOccurred = true
      stoppageReason = 'three_knockdown_rule'
      stoppageFighterId = fA.id
    }
  }

  // TKO check — sustained heavy damage with poor recovery prompts referee stoppage.
  // Craven fighter is more likely to be stopped when hurt.
  if (!stoppageOccurred) {
    const recoveryA = getAttr(fA, 'recovery_rate')
    const recoveryB = getAttr(fB, 'recovery_rate')
    const heartA = getAttr(fA, 'heart')
    const heartB = getAttr(fB, 'heart')

    // TKO threshold: damage exceeds chin threshold × 1.5 AND heart/recovery don't save them
    const chinThreshB = getAttr(fB, 'chin') * fighterBState.healthModifiers.chinModifier * 2
    const chinThreshA = getAttr(fA, 'chin') * fighterAState.healthModifiers.chinModifier * 2

    if (damageToB > chinThreshB * 1.5) {
      const stopProb = (damageToB - chinThreshB * 1.5) / (chinThreshB * 1.5)
      const survivalMod = (heartB + recoveryB) / 40  // 0.0-1.0, higher = harder to stop
      const craveMod = hasTrait(fB, 'craven') ? 1.5 : 1.0
      if (rng.next() < stopProb * (1 - survivalMod * 0.5) * craveMod) {
        stoppageOccurred = true
        stoppageReason = 'tko_referee'
        stoppageFighterId = fB.id
      }
    } else if (damageToA > chinThreshA * 1.5) {
      const stopProb = (damageToA - chinThreshA * 1.5) / (chinThreshA * 1.5)
      const survivalMod = (heartA + recoveryA) / 40
      const craveMod = hasTrait(fA, 'craven') ? 1.5 : 1.0
      if (rng.next() < stopProb * (1 - survivalMod * 0.5) * craveMod) {
        stoppageOccurred = true
        stoppageReason = 'tko_referee'
        stoppageFighterId = fA.id
      }
    }
  }

  // KO check — very high damage beyond the knockdown threshold
  if (!stoppageOccurred && (knockdownsThisRoundA > 0 || knockdownsThisRoundB > 0)) {
    const chinThreshB = getAttr(fB, 'chin') * fighterBState.healthModifiers.chinModifier * 2
    const chinThreshA = getAttr(fA, 'chin') * fighterAState.healthModifiers.chinModifier * 2

    if (knockdownsThisRoundB > 0 && damageToB > chinThreshB * 2) {
      stoppageOccurred = true
      stoppageReason = 'ko'
      stoppageFighterId = fB.id
    } else if (knockdownsThisRoundA > 0 && damageToA > chinThreshA * 2) {
      stoppageOccurred = true
      stoppageReason = 'ko'
      stoppageFighterId = fA.id
    }
  }

  // ─── Scoring ──────────────────────────────────────────────────────────────────

  // Clear rounds (abs(dominance) > 0.3): deterministic 10-9 for the winner.
  // Close rounds: each judge independently applies ±0.15 variance to dominance.
  // A judge can score 10-9 either way, or 10-10 for a genuinely even round.
  // Split and majority decisions emerge naturally when judges disagree on close rounds.

  let fighterAScore = 10
  let fighterBScore = 10

  if (Math.abs(dominance) > 0.3) {
    // Clear round — no variance needed
    if (dominance > 0) fighterBScore = 9
    else if (dominance < 0) fighterAScore = 9
  }
  // Close round scoring handled by judges — per-round score uses the modal judge decision
  // (the individual judge scores are tracked in judgeScores on BoutResolutionResult)
  else {
    // For the round score, use a single judge perspective (first judge's variance).
    // The full three-judge breakdown happens in resolveBout when building scorecards.
    const judgeVariance = (rng.next() - 0.5) * 0.30  // ±0.15 range
    const judgedDominance = dominance + judgeVariance
    if (judgedDominance > 0.05) fighterBScore = 9
    else if (judgedDominance < -0.05) fighterAScore = 9
    // else 10-10
  }

  // Standing eight count: if available and a knockdown occurred, give partial stamina recovery
  // before the round effectively continues. Represents the referee's intervention giving
  // the hurt fighter a moment to recover — reducing but not eliminating the danger.
  let staminaAEnd = Math.max(0, input.fighterAStamina - computeStaminaDepletion(fA, conditions.roundDurationMinutes))
  let staminaBEnd = Math.max(0, input.fighterBStamina - computeStaminaDepletion(fB, conditions.roundDurationMinutes))

  if (conditions.standingEightAvailable) {
    if (knockdownsThisRoundB > 0) staminaBEnd = Math.min(staminaBEnd + 5, input.fighterBStamina)
    if (knockdownsThisRoundA > 0) staminaAEnd = Math.min(staminaAEnd + 5, input.fighterAStamina)
  }

  // Brave fighters recover better from knockdowns — their heart keeps them going.
  // Craven fighters see more of their remaining stamina collapse after a knockdown.
  if (knockdownsThisRoundB > 0) {
    if (hasTrait(fB, 'brave')) staminaBEnd = Math.min(100, staminaBEnd + 5)
    if (hasTrait(fB, 'craven')) staminaBEnd = Math.max(0, staminaBEnd - 5)
  }
  if (knockdownsThisRoundA > 0) {
    if (hasTrait(fA, 'brave')) staminaAEnd = Math.min(100, staminaAEnd + 5)
    if (hasTrait(fA, 'craven')) staminaAEnd = Math.max(0, staminaAEnd - 5)
  }

  const roundScore: RoundScore = {
    roundNumber: input.roundNumber,
    fighterAScore,
    fighterBScore,
    dominance,
    knockdownsA: knockdownsThisRoundA,
    knockdownsB: knockdownsThisRoundB,
    stoppageOccurred,
    ...(stoppageReason !== undefined ? { stoppageReason } : {}),
    ...(stoppageFighterId !== undefined ? { stoppageFighterId } : {}),
  }

  return {
    roundScore,
    fighterAStaminaEnd: staminaAEnd,
    fighterBStaminaEnd: staminaBEnd,
    fighterADamageThisRound: damageToA,
    fighterBDamageThisRound: damageToB,
  }
}
