// Matches universal/soul-traits.json
import type { Meta } from './meta.js'

export type RevealDifficulty = 'easy' | 'medium' | 'hard'

export interface SoulTraitDef {
  id: string
  revealDifficulty: RevealDifficulty
  description: string
}

export interface SoulTraitPair {
  id: string
  // Probability (0.0-1.0) that sideA is chosen when this pair is selected.
  // Reflects real-world distribution — brave more common than craven, etc.
  sideAWeight: number
  sideA: SoulTraitDef
  sideB: SoulTraitDef
}

export interface SoulTraitsData {
  meta: Meta
  pairs: SoulTraitPair[]
}
