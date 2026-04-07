// Matches universal/gifts-and-flaws.json
import type { Meta } from './meta.js'

// Present when the gift or flaw nudges health body part generation probabilities.
export interface HealthNudge {
  bodyParts: string[]
  giftShift: string
  flawShift: string
}

export interface GiftOrFlaw {
  id: string
  type: 'gift' | 'flaw'
  appliesTo: string
  attributeCeilingBoost: number
  giftProbability: number
  flawProbability: number
  // Events the moment system requires before this gift or flaw can be revealed.
  discoveryConditions: string[]
  // null when this entry has no health system side-effect.
  healthNudge: HealthNudge | null
  description: string
}

export interface GiftsAndFlawsData {
  meta: Meta
  giftsAndFlaws: GiftOrFlaw[]
}
