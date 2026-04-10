// Types for style-matchups.json and style-development.json

import type { Meta } from './meta.js'

export type StyleTendencyId =
  | 'pressure'
  | 'boxer'
  | 'boxer_puncher'
  | 'brawler'
  | 'counterpuncher'
  | 'swarmer'
  | 'undefined'

export interface StyleThresholds {
  // Minimum attribute values for full style expression.
  // Below threshold: styleEffectiveness = attribute / threshold
  [styleId: string]: Record<string, number>
}

export interface StyleWildcard {
  condition: string
  effect: string
  threshold?: number
  threshold_ringIq?: number
  threshold_outputVolume?: number
  note?: string
}

export interface StyleMatchup {
  id: string
  styles: string[]
  description: string
  exchangeInitiationAdvantage: 'styleA' | 'styleB' | 'neutral'
  distanceControlAdvantage: 'styleA' | 'styleB' | 'neutral'
  decisiveAttributesA: string[] | string
  decisiveAttributesB: string[] | string
  modifiers: Record<string, number>
  wildcards: StyleWildcard[]
  narrativeNotes: string
}

export interface StyleMatchupsData {
  meta: Meta
  styleThresholds: StyleThresholds
  matchups: StyleMatchup[]
}

export interface TendencyStrengthGrowth {
  perTrainingWeek: number
  perAmateur_bout: number
  perPro_bout: number
  maximumPerYear: number
  note: string
}

export interface CoachInfluenceShiftRates {
  newCoach_year1: number
  newCoach_year2: number
  newCoach_year3_plus: number
  note: string
}

export interface CoachInfluence {
  description: string
  shiftPerYear: CoachInfluenceShiftRates
  soulTraitModifiers: Record<string, number>
  tendencyStrengthResistance: { note: string; example: string }
}

export interface StyleDevelopmentData {
  meta: Meta
  tendencyStrengthGrowth: TendencyStrengthGrowth
  coachInfluence: CoachInfluence
  styleCompatibilityWithAttributes: {
    description: string
    effectivenessFormula: string
    note: string
  }
}
