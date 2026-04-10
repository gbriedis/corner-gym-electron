// Matches universal/attribute-accumulation.json
// Typed to cover all sections used by the bout resolution and training engines.
// Every attribute change in the simulation flows through these rules.

export interface MentalAttributeStartingCap {
  noBouts: number
  fewBouts_1_to_5: number
  experienced_6_to_20: number
  veteran_21_plus: number
  note?: string
}

export interface BackgroundModifiers {
  selfTaught: number
  priorGym: number
  note?: string
}

export interface StartingValueFormula {
  baseByYearsTraining: Record<string, number | string>
  mentalAttributeStartingCap: MentalAttributeStartingCap
  backgroundModifiers: BackgroundModifiers
}

// A single event type entry — training, sparring, or bout.
// Bout types may inherit from another event type and add an overall multiplier.
export interface EventGainEntry {
  // Present on base types (training_session, amateur_bout, pro_bout).
  gains?: Record<string, number>
  // Present on inherited types (title_fight, olympic_bout).
  // The engine resolves the parent gains and applies overallMultiplier, then
  // replaces specific attributes with additionalGains values.
  inheritsFrom?: string
  overallMultiplier?: number
  additionalGains?: Record<string, number>
  // Training-specific: which attributes this event type can affect.
  applicableAttributes?: string[]
  mentalGains?: null
  note?: string
}

// Per-result modifiers — applied after base gains.
// stoppage_loss can produce negative deltas (composure/heart regression).
export interface ResultModifierEntry {
  multiplier: number
  // Per-attribute overrides that replace the base multiplier for that attribute.
  attributeOverrides?: Record<string, number>
  note?: string
}

// A single opposition quality band — how strong was the opponent relative to the fighter?
export interface OppositionQualityEntry {
  // Ratio = fighterLevel / opponentLevel. Below threshold = fighter is weaker = opponent is better.
  thresholdRatio: number | null
  multiplier: number
}

// How soul traits modify attribute gains from bouts.
// appliesTo narrows which attributes get the multiplier.
// "all_technical" and "all" are special tokens the engine expands at runtime.
export interface SoulTraitMultiplierEntry {
  appliesTo: string | string[]
  gainMultiplier?: number
  regressionMultiplier?: number
  lossGainMultiplier?: number
  stoppageRecoveryMultiplier?: number
  stoppageRegressionMultiplier?: number
  highStakesMultiplier?: number
  coachingMultiplier?: number
  inactivityRegressionMultiplier?: number
  trainingConsistencyBonus?: number
  gainVariance?: number
  outputVolumeBonus?: number
  ceilingEffect?: boolean
  note?: string
}

export interface AttributeAccumulationData {
  startingValueFormula: StartingValueFormula
  // Keyed by event type: training_session, sparring, amateur_bout, pro_bout, title_fight, olympic_bout
  eventBaseGains: Record<string, EventGainEntry>
  resultModifiers: {
    win: ResultModifierEntry
    loss: ResultModifierEntry
    stoppage_loss: ResultModifierEntry
  }
  oppositionQualityMultipliers: {
    significantly_better: OppositionQualityEntry
    better: OppositionQualityEntry
    matched: OppositionQualityEntry
    weaker: OppositionQualityEntry
    significantly_weaker: OppositionQualityEntry
    note?: string
  }
  // Keyed by soul trait id (brave, craven, humble, etc.)
  soulTraitMultipliers: Record<string, SoulTraitMultiplierEntry>
  // Max gain any single event can produce per attribute, regardless of stacked multipliers.
  // Also has a "note" key with a string — the rest are numbers.
  singleEventGainCap: {
    training_session: number
    sparring: number
    amateur_bout: number
    pro_bout: number
    title_fight: number
    olympic_bout: number
    note?: string
  }
}
