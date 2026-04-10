// competition.ts defines the structural containers for boxing competition.
// Bouts, cards, brackets, and multi-day events are containers — they hold
// fighter assignments and results but contain no simulation logic.
// The fight engine fills these containers when events run.

import type { Meta } from './data/meta.js'

// ─── Bout ────────────────────────────────────────────────────────────────────

export type BoutStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_contest'

export type BoutMethod =
  | 'ko'
  | 'tko'
  | 'decision'
  | 'technical_decision'
  | 'no_contest'
  | 'draw'

// Per-judge scorecard stored on a completed Bout — used in BoutResult.
// Named BoutJudgeScore to distinguish from JudgeScorecard in resolution.ts,
// which carries per-judge totals and a winner determination.
export interface BoutJudgeScore {
  judgeId: string
  fighterAScore: number
  fighterBScore: number
}

export interface BoutResult {
  winnerId: string | null       // null = draw or no_contest
  method: BoutMethod
  endRound: number
  judgeScores?: BoutJudgeScore[]
}

export interface Bout {
  id: string
  eventId: string
  circuitLevel: string
  weightClassId: string
  ageCategoryId: string
  fighterAId: string
  fighterBId: string
  gymAId: string
  gymBId: string
  scheduledRounds: number
  status: BoutStatus
  result?: BoutResult
  // roundResults added by fight engine when bout runs — not defined here
}

// ─── Card ────────────────────────────────────────────────────────────────────

// A card is a collection of individual bouts on the same night.
// No bracket advancement — each bout is independent.
// Club tournaments use card format.

export type CardVisibility = 'private' | 'public'
// private: club card — player knows their bout, sees results as they happen
// public: regional+ — full card announced in advance

export interface Card {
  id: string
  eventId: string
  boutIds: string[]             // ordered list — fight order matters for atmosphere
  visibility: CardVisibility
}

// ─── Tournament Bracket ───────────────────────────────────────────────────────

// A tournament bracket is a structured advancement competition.
// Fighters advance through rounds — quarterfinals, semifinals, final.
// Regional opens, nationals, and all international events use bracket format.

export interface TournamentEntrant {
  fighterId: string
  gymId: string
  nationId: string
  seed?: number                 // seeded at nationals based on ranking points
}

export interface TournamentRound {
  roundNumber: number           // 1 = quarterfinal, 2 = semi, 3 = final
  label: string                 // "Quarterfinals", "Semifinals", "Final"
  day: number                   // which day of a multi-day event
  boutIds: string[]
}

export interface TournamentBracket {
  id: string
  eventId: string
  weightClassId: string
  ageCategoryId: string
  entrants: TournamentEntrant[]
  rounds: TournamentRound[]
  winnerId?: string
  status: 'open'                // open = accepting entrants
         | 'closed'             // closed = bracket generated, no more entries
         | 'in_progress'
         | 'completed'
}

// ─── Multi-day Event ──────────────────────────────────────────────────────────

// Multi-day events (nationals, international championships) run across
// multiple days. Each day has its own session of bouts.
// Day 1 = quarterfinals, Day 2 = semifinals, Day 3 = finals.

export interface MultiDayEvent {
  eventId: string
  days: MultiDaySession[]
}

export interface MultiDaySession {
  dayNumber: number
  year: number
  week: number
  dayOfWeek: number             // 1=Mon, 7=Sun
  bracketIds: string[]          // one bracket per weight class per day
}

// ─── Rules ───────────────────────────────────────────────────────────────────

export type ScoringSystem =
  | '10_point_must'
  | '10_point_must_computerised'

export interface AgeCategory {
  id: string
  label: string
  minAge: number
  maxAge: number
}

export interface CircuitRules {
  circuitLevel: string
  ageCategory: string
  rounds: number
  roundDurationMinutes: number
  restDurationMinutes: number
  scoringSystem: ScoringSystem
  headgearRequired: boolean
  gloveWeightOz: number
  standingEightCount: boolean
  threeKnockdownRule: boolean
  maxBoutsPerDay: number
  description: string
}

export interface RulesData {
  meta: Meta
  sanctioningBodyId: string
  ageCategories: AgeCategory[]
  circuitRules: CircuitRules[]
}
