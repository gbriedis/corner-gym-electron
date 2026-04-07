// Matches universal/soul-traits.json
import type { Meta } from './meta.js'

export type RevealDifficulty = 'easy' | 'medium' | 'hard'

export interface SoulTrait {
  id: string
  opposite: string
  revealDifficulty: RevealDifficulty
  description: string
}

export interface SoulTraitsData {
  meta: Meta
  traits: SoulTrait[]
}
