import type { Person } from './person.js'
import type { Clause } from './clause.js'

// Fighter is a Person who has entered the competitive boxing world.
// Every field on Person remains — Fighter adds what competition requires.
// References:
//   weightClassId      → universal/weight-classes.json
//   attributeId        → universal/attributes.json
//   boutIds            → bouts SQLite table
//   beltId             → international/boxing/pro-title-belts.json
//   sanctioningBodyId  → sanctioning-bodies.json (amateur or pro)
//   promoterId         → universal/promoters.json
//   clauseType         → universal/pro-fight-offer.json
//   gymId              → src/types/gym.ts
//   coachId            → src/types/coach.ts
//   managerId          → src/types/manager.ts
//   circuitLevel       → src/types/data/boxing.ts CircuitLevel

export type FighterIdentityState =
  | 'unaware'     // never considered competing
  | 'curious'     // the question is forming
  | 'aspiring'    // actively wants to compete
  | 'competing'   // has competed, self-identifies as fighter
  | 'retired'     // competed, no longer does

export type RetirementReason =
  | 'voluntary'
  | 'injury'
  | 'age'
  | 'loss_of_drive'

export type CompetitionStatus =
  | 'unregistered'  // never competed officially
  | 'amateur'       // registered with national amateur body
  | 'pro'           // turned professional

export type StyleTendency =
  | 'pressure'
  | 'boxer'
  | 'boxer_puncher'
  | 'brawler'
  | 'counterpuncher'
  | 'swarmer'
  | 'undefined'     // raw fighter, style not yet formed

export type AmbitionLevel =
  | 'undecided'
  | 'local'
  | 'national'
  | 'international'
  | 'olympic'
  | 'world_title'
  | 'undisputed'

export type StagnationState =
  | 'developing'
  | 'plateauing'
  | 'stagnating'

// ─── Sub-interfaces ───────────────────────────────────────────────────────────

export interface FighterIdentity {
  state: FighterIdentityState
  stateChangedYear: number
  stateChangedWeek: number
  retirementReason?: RetirementReason
}

export interface BoxingBackground {
  // Set at generation — never changes.
  // Drives starting developed attribute values.
  yearsTraining: number
  firstTrainedAge: number
  selfTaught: boolean
  priorGymId: string | null
  priorGymNationId: string | null
}

export interface DevelopedAttribute {
  // A developed attribute has both a current value and a generation ceiling.
  // Current value changes through training, fighting, and inactivity.
  // generationCeiling is 18 for gift-eligible attributes (without gift), 20 otherwise.
  // currentPotential is generationCeiling + any gift bonus (max 20 absolute).
  attributeId: string
  current: number
  currentPotential: number    // ceiling after gifts applied — never exceeds 20
  generationCeiling: number   // ceiling at generation — 18 or 20 depending on attribute
}

export interface AttributeHistoryEvent {
  // Records every significant attribute change for history and dev mode analysis.
  year: number
  week: number
  trigger: 'training' | 'sparring' | 'amateur_bout' | 'pro_bout' | 'title_fight' | 'olympic_bout' | 'inactivity' | 'age_regression'
  delta: number               // positive = growth, negative = regression
  oppositionQuality?: number  // 0-100, for bout events
}

export interface AttributeHistory {
  attributeId: string
  baseValue: number           // value at generation
  events: AttributeHistoryEvent[]
}

export interface FighterStyle {
  currentTendency: StyleTendency
  tendencyStrength: number    // 0-100. Low = undefined. High = clearly one thing.
  southpaw: boolean
}

export interface AmateurTitle {
  circuitLevel: string
  weightClassId: string
  wonYear: number
  wonWeek: number
  eventId: string
}

export interface Medal {
  type: 'gold' | 'silver' | 'bronze'
  circuitLevel: string
  eventId: string
  year: number
}

export interface AmateurRanking {
  sanctioningBodyId: string
  weightClassId: string
  position: number
  points: number
}

export interface ProTitle {
  beltId: string              // references pro-title-belts.json
  sanctioningBodyId: string
  weightClassId: string
  wonYear: number
  wonWeek: number
  defences: number
  active: boolean
  vacatedYear?: number
  vacatedWeek?: number
}

export interface ProRanking {
  sanctioningBodyId: string   // wbc, wba, ibf, wbo
  weightClassId: string
  position: number            // 1-15
  points: number
}

export interface AmateurCareer {
  wins: number
  losses: number
  boutIds: string[]
  titles: AmateurTitle[]
  medals: Medal[]
  rankings: AmateurRanking[]
  registeredWithBodyId: string | null
}

export interface ProCareer {
  wins: number
  losses: number
  draws: number
  knockouts: number           // KO/TKO wins only
  boutIds: string[]
  titles: ProTitle[]
  rankings: ProRanking[]
  promoterId: string | null
  contractStartYear: number | null
  contractStartWeek: number | null
  contractEndYear: number | null
  contractEndWeek: number | null
  activeClauses: Clause[]
  managerId: string | null
}

export interface FighterAmbitions {
  level: AmbitionLevel
  goalCircuitLevel: string | null
  timeframe: 'patient' | 'urgent'
  proBeltTarget: string | null   // specific belt id, e.g. 'wbc_world_lightweight'
}

export interface PastCoachRecord {
  // History of past coaching relationships — travels with the fighter.
  // New gym starts fresh but past coaches shaped who this fighter became.
  coachId: string
  gymId: string
  startYear: number
  startWeek: number
  endYear: number | null      // null if still active
  endWeek: number | null
  peakTrustScore: number      // highest trust reached in this relationship
  weeksWorkedTogether: number
}

export interface FighterCareerState {
  currentGymId: string | null
  gymJoinedYear: number | null
  gymJoinedWeek: number | null
  coachId: string | null
  ambitions: FighterAmbitions
  stagnationState: StagnationState
  loyaltyScore: number          // 0-100, relationship with current gym
  coachabilityScore: number     // 0-100, derived from soul traits + coach relationship
  readiness: number             // 0-100, engine assessment — never shown as number to player
  lastBoutYear: number | null
  lastBoutWeek: number | null
  coachingHistory: PastCoachRecord[]
}

export interface PlayerKnowledge {
  // Respects the ocean rule — what the player actually knows about this fighter.
  depthLevel: number            // 0-5, how well player knows this person
  revealedSoulTraits: string[]
  revealedPhysicalGifts: string[]
  revealedFlaws: string[]
  firstMetYear: number | null
  firstMetWeek: number | null
  lastInteractionYear: number | null
  lastInteractionWeek: number | null
  notes: string[]               // player's own observations, added via UI
}

// ─── Fighter ─────────────────────────────────────────────────────────────────

export interface Fighter extends Person {
  // Layer 1 — Fighter Identity
  fighterIdentity: FighterIdentity

  // Layer 2 — Boxing Background (set at generation, never changes)
  boxingBackground: BoxingBackground

  // Layer 3 — Developed Attributes (grow through training and fighting)
  developedAttributes: DevelopedAttribute[]

  // Layer 4 — Attribute History (engine analysis and dev mode)
  attributeHistory: AttributeHistory[]

  // Layer 5 — Style (emerges, not assigned)
  style: FighterStyle

  // Layer 6 — Competition Record
  competition: {
    status: CompetitionStatus
    weightClassId: string
    amateur: AmateurCareer
    pro: ProCareer
  }

  // Layer 7 — Career State
  career: FighterCareerState

  // Layer 8 — Player Knowledge (ocean rule)
  playerKnowledge: PlayerKnowledge
}
