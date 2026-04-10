// boutAssessment derives everything the resolution engine needs
// before the first round begins. Reads rules from data files —
// nothing about bout conditions is hardcoded here.
//
// The rules file determines:
// - How many rounds and how long they are
// - Whether headgear reduces damage
// - Whether standing eight count gives recovery time
// - Whether three knockdown rule ends fights early
// - Glove weight damage multiplier
//
// This is why every bout result can differ between circuit levels
// with the same two fighters — the conditions shape the outcome.

import type { Fighter } from '../types/fighter.js'
import type { Coach } from '../types/coach.js'
import type { CircuitRules } from '../types/competition.js'
import type { StyleMatchup, StyleTendencyId } from '../types/data/style.js'
import type { BoutResolutionInput } from '../types/resolution.js'
import type { GameData } from '../data/loader.js'
import { getMatchup, getEffectiveModifiers } from './styleEngine.js'
import { calculateStyleEffectiveness } from '../generation/fighter.js'

export interface FighterBoutState {
  fighter: Fighter
  coach: Coach | null

  // Derived from rules + fighter state
  effectiveDamageMultiplier: number   // reduced by glove weight and headgear
  staminaBaseline: number             // 0-100, derived from fighter's stamina attribute
  styleEffectiveness: number          // from calculateStyleEffectiveness
  healthModifiers: {
    chinModifier: number              // reduced if chin health is damaged
    handOutputModifier: number        // reduced if hand health is damaged
    overallDurabilityModifier: number
  }
}

export interface BoutConditions {
  rules: CircuitRules
  scheduledRounds: number
  roundDurationMinutes: number
  // Heavier gloves distribute force across a larger surface area, reducing both
  // cutting and concussive impact. This is why amateur bouts with headgear produce
  // far less accumulated damage than pro bouts with smaller gloves.
  gloveDamageMultiplier: number     // derived from gloveWeightOz — heavier = less damage
  headgearDamageMultiplier: number  // 1.0 if no headgear, 0.75 if headgear required
  standingEightAvailable: boolean
  threeKnockdownRule: boolean
  matchup: StyleMatchup
  // styleA in the matchup corresponds to which fighter — used to apply directional bonuses
  matchupSideA: 'styleA' | 'styleB'
  // Pre-scaled by both fighters' style effectiveness
  effectiveModifiers: Record<string, number>
}

// getAttr searches both attribute pools for a value by attributeId.
// Physical attributes (power, chin, stamina etc.) are on fighter.attributes;
// developed attributes (technique, ring_iq etc.) are on fighter.developedAttributes.
// Returning 0 for missing attributes is safe: it contributes nothing to the fight.
function getAttr(fighter: Fighter, id: string): number {
  const dev = fighter.developedAttributes.find(a => a.attributeId === id)
  if (dev !== undefined) return dev.current
  const phys = fighter.attributes.find(a => a.attributeId === id)
  return phys?.current ?? 0
}

// getHealthIntegrity returns the integrity of a body part scaled to 0-100.
// Integrity is stored on a 1-20 scale; × 5 normalises to the same scale as
// the health modifier thresholds. Returns 100 if the part is not tracked.
function getHealthIntegrity(fighter: Fighter, partId: string): number {
  const hv = fighter.health.find(h => h.bodyPartId === partId)
  return hv !== undefined ? hv.integrity * 5 : 100
}

// gloveDamageMultiplierFromOz converts glove weight to a damage multiplier.
// Lighter gloves = more damage per punch. 10oz is the baseline.
function gloveDamageMultiplierFromOz(oz: number): number {
  if (oz <= 8) return 1.10
  if (oz <= 10) return 1.00
  if (oz <= 12) return 0.90
  return 0.80  // 16oz+ heavy training gloves
}

// buildHealthModifiers derives chin and hand modifiers from a fighter's health state.
// Damaged chin health → takes more concussive damage, more vulnerable to knockdown.
// Damaged hand health → reduced output volume as fighter protects sore hands.
function buildHealthModifiers(fighter: Fighter): FighterBoutState['healthModifiers'] {
  const chinHealth = getHealthIntegrity(fighter, 'chin')
  const handHealth = getHealthIntegrity(fighter, 'hands')

  let chinModifier = 1.0
  if (chinHealth < 25) chinModifier = 0.5
  else if (chinHealth < 50) chinModifier = 0.7

  let handOutputModifier = 1.0
  if (handHealth < 25) handOutputModifier = 0.6
  else if (handHealth < 50) handOutputModifier = 0.8

  // Overall durability is the average of all remaining health integrity.
  // Used to scale general wear accumulation per round.
  const bodyParts = ['hands', 'chin', 'jaw', 'knees', 'shoulders', 'ribs', 'elbows']
  const sum = bodyParts.reduce((acc, p) => acc + getHealthIntegrity(fighter, p), 0)
  const overallDurabilityModifier = Math.max(0.5, (sum / bodyParts.length) / 100)

  return { chinModifier, handOutputModifier, overallDurabilityModifier }
}

// findCircuitRules searches all loaded rule sets (nation + international) for the
// CircuitRules matching a specific circuitLevel + ageCategory combination.
// A fight at club_card senior level uses different rules than national_championship junior.
function findCircuitRules(
  data: GameData,
  circuitLevel: string,
  ageCategoryId: string,
): CircuitRules | undefined {
  const allRuleSets = [
    ...Object.values(data.nations)
      .map(n => n.boxing?.rules)
      .filter((r): r is NonNullable<typeof r> => r !== undefined),
    data.international.boxing.eubcRules,
    data.international.boxing.ibaRules,
  ]

  for (const ruleSet of allRuleSets) {
    const match = ruleSet.circuitRules.find(
      r => r.circuitLevel === circuitLevel && r.ageCategory === ageCategoryId,
    )
    if (match !== undefined) return match
  }
  return undefined
}

export function assessBout(
  input: BoutResolutionInput,
  data: GameData,
): { fighterAState: FighterBoutState; fighterBState: FighterBoutState; conditions: BoutConditions } {
  const rules = findCircuitRules(data, input.circuitLevel, input.ageCategoryId)
  if (rules === undefined) {
    throw new Error(
      `No rules found for circuitLevel="${input.circuitLevel}" ageCategoryId="${input.ageCategoryId}"`,
    )
  }

  const gloveMult = gloveDamageMultiplierFromOz(rules.gloveWeightOz)
  // Headgear absorbs and spreads impact — significantly reduces accumulated damage
  // and knockdown risk in amateur bouts. This is the primary reason professional
  // bouts produce more career damage than an equivalent number of amateur bouts.
  const headgearMult = rules.headgearRequired ? 0.75 : 1.0

  const styleA = input.fighterA.style.currentTendency as StyleTendencyId
  const styleB = input.fighterB.style.currentTendency as StyleTendencyId
  const matchup = getMatchup(styleA, styleB, data)

  const effectivenessA = calculateStyleEffectiveness(
    input.fighterA.style,
    input.fighterA.developedAttributes,
    input.fighterA.attributes,
    data,
  )
  const effectivenessB = calculateStyleEffectiveness(
    input.fighterB.style,
    input.fighterB.developedAttributes,
    input.fighterB.attributes,
    data,
  )
  const effectiveModifiers = getEffectiveModifiers(matchup, effectivenessA, effectivenessB)

  // Determine which side of the matchup definition fighter A occupies.
  // matchup.styles[0] is "styleA" in descriptions like exchangeInitiationAdvantage.
  // Needed so roundResolution can apply directional style bonuses correctly.
  const matchupSideA: 'styleA' | 'styleB' =
    matchup.styles[0] === styleA ? 'styleA' : 'styleB'

  const buildState = (
    fighter: Fighter,
    coach: Coach | null,
  ): FighterBoutState => {
    const healthModifiers = buildHealthModifiers(fighter)
    const staminaAttr = getAttr(fighter, 'stamina')
    // Normalise stamina attribute (1-20) to the 0-100 depletion tracking scale.
    const staminaBaseline = Math.min(100, staminaAttr * 5)

    const styleEffectiveness = calculateStyleEffectiveness(
      fighter.style,
      fighter.developedAttributes,
      fighter.attributes,
      data,
    )

    // effectiveDamageMultiplier combines glove and headgear effects.
    // This is how much damage THIS fighter absorbs per unit of opponent dominance.
    const effectiveDamageMultiplier = gloveMult * headgearMult

    return {
      fighter,
      coach,
      effectiveDamageMultiplier,
      staminaBaseline,
      styleEffectiveness,
      healthModifiers,
    }
  }

  return {
    fighterAState: buildState(input.fighterA, input.coachA),
    fighterBState: buildState(input.fighterB, input.coachB),
    conditions: {
      rules,
      scheduledRounds: rules.rounds,
      roundDurationMinutes: rules.roundDurationMinutes,
      gloveDamageMultiplier: gloveMult,
      headgearDamageMultiplier: headgearMult,
      standingEightAvailable: rules.standingEightCount,
      threeKnockdownRule: rules.threeKnockdownRule,
      matchup,
      matchupSideA,
      effectiveModifiers,
    },
  }
}
