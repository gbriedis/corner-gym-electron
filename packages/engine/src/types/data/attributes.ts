// Matches universal/attributes.json
import type { Meta } from './meta.js'

export type AttributeCategory = 'striking' | 'defense' | 'physical' | 'mental'

// Gift-eligible attributes have generationMax and absoluteMax instead of max.
// Non-gift-eligible attributes have max only.
export interface AttributeScale {
  min: number
  max?: number
  generationMax?: number
  absoluteMax?: number
}

export interface Attribute {
  id: string
  category: AttributeCategory
  scale: AttributeScale
  description: string
}

export interface AttributesData {
  meta: Meta
  attributes: Attribute[]
}
