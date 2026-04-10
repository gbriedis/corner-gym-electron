// Types for bout resolution. These are the outputs of resolveBout —
// consumed by the backrun engine, the SQLite layer, and eventually
// the exchange simulation layer.

import type { Fighter } from './fighter.js'
import type { Coach } from './coach.js'
import type { AttributeHistoryEvent } from './fighter.js'

// Method type for the resolution engine — broader than BoutMethod in competition.ts
// because split/majority decisions emerge from the judge scoring logic.
export type ResolutionMethod =
  | 'ko'
  | 'tko'
  | 'decision'
  | 'split_decision'
  | 'majority_decision'
  | 'draw'
  | 'no_contest'

export interface BoutResolutionInput {
  boutId: string
  fighterA: Fighter
  fighterB: Fighter
  coachA: Coach | null
  coachB: Coach | null
  circuitLevel: string
  ageCategoryId: string
  eventId: string
  year: number
  week: number
}

export interface RoundScore {
  roundNumber: number
  fighterAScore: number      // 10-point must — winner gets 10, loser gets 9 or less
  fighterBScore: number
  dominance: number          // -1.0 to 1.0. Positive = A winning round. Used for narrative.
  knockdownsA: number
  knockdownsB: number
  stoppageOccurred: boolean
  stoppageReason?: 'ko' | 'tko_referee' | 'tko_corner' | 'tko_cuts' | 'three_knockdown_rule'
  stoppageFighterId?: string  // who was stopped
}

export interface DamageAccumulated {
  // Damage state at end of bout — affects fighter health going forward.
  totalPunchesAbsorbed: number
  knockdowns: number
  chinDamage: number         // 0-100. High = chin more vulnerable in future bouts.
  handDamage: number         // 0-100. High = reduced punch output in future bouts.
  overallWear: number        // 0-100. General accumulated damage.
}

// Per-judge total scorecard — produced by resolveBout after all rounds scored.
// Three judges always score independently; split/majority decisions emerge naturally
// when judges disagree on close rounds.
export interface JudgeScorecard {
  judgeIndex: number         // 1, 2, or 3
  fighterATotal: number
  fighterBTotal: number
  winnerId: string | null
}

export interface BoutResolutionResult {
  boutId: string
  winnerId: string | null    // null = draw
  loserId: string | null
  method: ResolutionMethod
  endRound: number
  scheduledRounds: number
  roundScores: RoundScore[]
  judgeScores: JudgeScorecard[]
  fighterADamage: DamageAccumulated
  fighterBDamage: DamageAccumulated
  fighterAAttributeEvents: AttributeHistoryEvent[]
  fighterBAttributeEvents: AttributeHistoryEvent[]
}
