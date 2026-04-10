// resolveBout is the single source of truth for bout outcomes.
// Used by the backrun for every historical bout.
// Used by the live simulation as the result layer beneath the exchange narrative.
//
// Produces a deterministic result from the same seed — the same two fighters
// in the same conditions always produce the same outcome.
// This is critical for the backrun: world history must be reproducible.

import { assessBout } from './boutAssessment.js'
import { resolveRound } from './roundResolution.js'
import { calculateAttributeEvents } from './attributeEvents.js'
import type { BoutResolutionInput, BoutResolutionResult, DamageAccumulated, JudgeScorecard, RoundScore, ResolutionMethod } from '../types/resolution.js'
import type { Fighter } from '../types/fighter.js'
import type { GameData } from '../data/loader.js'
import type { RNG } from '../utils/rng.js'

// computeOverallLevel derives a 0-100 level for a fighter based on developed attributes.
// Used to compute opposition quality ratio for attribute events.
function computeOverallLevel(fighter: Fighter): number {
  if (fighter.developedAttributes.length === 0) return 10
  const sum = fighter.developedAttributes.reduce((acc, a) => acc + a.current, 0)
  return (sum / fighter.developedAttributes.length) / 20 * 100
}

// tallyJudgeScorecard sums the per-round scores for a single simulated judge.
// The judge index determines which RNG calls were used during close-round variance —
// each judge is independent so different judges can score different fighters in close rounds.
function tallyJudgeScorecard(
  roundScores: RoundScore[],
  fighterAId: string,
  fighterBId: string,
  judgeIndex: number,
  rng: RNG,
): JudgeScorecard {
  let totalA = 0
  let totalB = 0

  for (const round of roundScores) {
    if (round.stoppageOccurred) {
      // Stopped rounds don't get judge scoring
      break
    }

    if (Math.abs(round.dominance) > 0.3) {
      // Clear round — all judges agree
      totalA += round.fighterAScore
      totalB += round.fighterBScore
    } else {
      // Close round — each judge independently varies
      const judgeVariance = (rng.next() - 0.5) * 0.30
      const judgedDominance = round.dominance + judgeVariance
      if (judgedDominance > 0.05) {
        totalA += 10; totalB += 9
      } else if (judgedDominance < -0.05) {
        totalA += 9; totalB += 10
      } else {
        totalA += 10; totalB += 10
      }
    }
  }

  const winnerId = totalA > totalB ? fighterAId
    : totalB > totalA ? fighterBId
    : null

  return { judgeIndex, fighterATotal: totalA, fighterBTotal: totalB, winnerId }
}

// determineDecisionMethod classifies a decision result based on judge agreement.
// Three judges scoring independently can produce unanimous, split, or majority decisions.
function determineDecisionMethod(
  scorecards: JudgeScorecard[],
  fighterAId: string,
  fighterBId: string,
): ResolutionMethod {
  const aWins = scorecards.filter(s => s.winnerId === fighterAId).length
  const bWins = scorecards.filter(s => s.winnerId === fighterBId).length
  const draws = scorecards.filter(s => s.winnerId === null).length

  if (aWins === 3 || bWins === 3) return 'decision'
  if (aWins === 2 || bWins === 2) return draws === 1 ? 'majority_decision' : 'split_decision'
  // 1-1-1 split or all draws
  if (aWins === 1 && bWins === 1) return 'split_decision'
  return 'draw'
}

export function resolveBout(
  input: BoutResolutionInput,
  data: GameData,
  rng: RNG,
): BoutResolutionResult {
  // 1. Pre-fight assessment — derive conditions and fighter states from data
  const { fighterAState, fighterBState, conditions } = assessBout(input, data)

  let staminaA = fighterAState.staminaBaseline
  let staminaB = fighterBState.staminaBaseline
  let knockdownsA = 0
  let knockdownsB = 0
  let roundsWonA = 0
  let roundsWonB = 0

  const roundScores: RoundScore[] = []
  let totalDamageToA = 0
  let totalDamageToB = 0
  let totalKnockdownsA = 0
  let totalKnockdownsB = 0
  let prevDominanceForA = 0
  let prevDominanceForB = 0

  let stoppageOccurred = false
  let stoppageFighterId: string | undefined
  let stoppageMethod: 'ko' | 'tko' | 'three_knockdown_rule' | undefined

  // 2. Resolve each round until stoppage or scheduled rounds complete
  for (let round = 1; round <= conditions.scheduledRounds; round++) {
    const result = resolveRound({
      roundNumber: round,
      fighterAState,
      fighterBState,
      conditions,
      fighterAStamina: staminaA,
      fighterBStamina: staminaB,
      fighterAKnockdowns: knockdownsA,
      fighterBKnockdowns: knockdownsB,
      fighterARoundsWon: roundsWonA,
      fighterBRoundsWon: roundsWonB,
      prevRoundDominanceForA: prevDominanceForA,
      prevRoundDominanceForB: prevDominanceForB,
      rng,
      data,
    })

    roundScores.push(result.roundScore)
    staminaA = result.fighterAStaminaEnd
    staminaB = result.fighterBStaminaEnd
    totalDamageToA += result.fighterADamageThisRound
    totalDamageToB += result.fighterBDamageThisRound
    totalKnockdownsA += result.roundScore.knockdownsA
    totalKnockdownsB += result.roundScore.knockdownsB
    knockdownsA = totalKnockdownsA
    knockdownsB = totalKnockdownsB

    // Track previous round dominance for soul trait effects (fragile)
    prevDominanceForA = result.roundScore.dominance
    prevDominanceForB = -result.roundScore.dominance

    if (result.roundScore.fighterAScore > result.roundScore.fighterBScore) roundsWonA++
    else if (result.roundScore.fighterBScore > result.roundScore.fighterAScore) roundsWonB++

    if (result.roundScore.stoppageOccurred) {
      stoppageOccurred = true
      stoppageFighterId = result.roundScore.stoppageFighterId
      const reason = result.roundScore.stoppageReason
      if (reason === 'ko') stoppageMethod = 'ko'
      else if (reason === 'tko_referee' || reason === 'tko_corner' || reason === 'tko_cuts') stoppageMethod = 'tko'
      else if (reason === 'three_knockdown_rule') stoppageMethod = 'tko'
      break
    }
  }

  // 3. Determine result
  let winnerId: string | null
  let loserId: string | null
  let method: ResolutionMethod
  const endRound = roundScores.length

  const judgeScores: JudgeScorecard[] = []

  if (stoppageOccurred && stoppageFighterId !== undefined) {
    loserId = stoppageFighterId
    winnerId = stoppageFighterId === input.fighterA.id ? input.fighterB.id : input.fighterA.id
    method = stoppageMethod === 'ko' ? 'ko' : 'tko'
  } else {
    // Decision — tally three independent judge scorecards.
    // Each judge gets their own RNG variance on close rounds.
    for (let j = 1; j <= 3; j++) {
      judgeScores.push(
        tallyJudgeScorecard(roundScores, input.fighterA.id, input.fighterB.id, j, rng),
      )
    }

    method = determineDecisionMethod(judgeScores, input.fighterA.id, input.fighterB.id)

    const aWins = judgeScores.filter(s => s.winnerId === input.fighterA.id).length
    const bWins = judgeScores.filter(s => s.winnerId === input.fighterB.id).length

    if (aWins > bWins) {
      winnerId = input.fighterA.id
      loserId = input.fighterB.id
    } else if (bWins > aWins) {
      winnerId = input.fighterB.id
      loserId = input.fighterA.id
    } else {
      winnerId = null
      loserId = null
      method = 'draw'
    }
  }

  // 4. Build damage accumulated records
  const buildDamage = (
    totalDamage: number,
    knockdowns: number,
    state: typeof fighterAState,
  ): DamageAccumulated => {
    // chinDamage and handDamage scale with total absorbed damage, capped at 100.
    // The effective multiplier determines how much of the raw damage reaches these structures.
    const chinDamage = Math.min(100, totalDamage * state.healthModifiers.chinModifier * 0.5)
    const handDamage = Math.min(100, totalDamage * 0.3)
    const overallWear = Math.min(100, totalDamage * state.healthModifiers.overallDurabilityModifier)
    // punchesAbsorbed is an approximation — each unit of damage ≈ 1 landed punch
    const totalPunchesAbsorbed = Math.round(totalDamage * 2)
    return { totalPunchesAbsorbed, knockdowns, chinDamage, handDamage, overallWear }
  }

  const fighterADamage = buildDamage(totalDamageToA, totalKnockdownsA, fighterAState)
  const fighterBDamage = buildDamage(totalDamageToB, totalKnockdownsB, fighterBState)

  // 5. Calculate attribute events for both fighters
  const overallA = computeOverallLevel(input.fighterA)
  const overallB = computeOverallLevel(input.fighterB)

  const resultA = winnerId === input.fighterA.id ? 'win'
    : loserId === input.fighterA.id ? 'loss'
    : 'draw'
  const resultB = winnerId === input.fighterB.id ? 'win'
    : loserId === input.fighterB.id ? 'loss'
    : 'draw'

  const fighterAAttributeEvents = calculateAttributeEvents(
    input.fighterA,
    resultA,
    method,
    overallB,
    input.circuitLevel,
    input.year,
    input.week,
    data,
  )

  const fighterBAttributeEvents = calculateAttributeEvents(
    input.fighterB,
    resultB,
    method,
    overallA,
    input.circuitLevel,
    input.year,
    input.week,
    data,
  )

  return {
    boutId: input.boutId,
    winnerId,
    loserId,
    method,
    endRound,
    scheduledRounds: conditions.scheduledRounds,
    roundScores,
    judgeScores,
    fighterADamage,
    fighterBDamage,
    fighterAAttributeEvents,
    fighterBAttributeEvents,
  }
}
