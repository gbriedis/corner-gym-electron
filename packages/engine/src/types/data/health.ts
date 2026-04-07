// Matches universal/health.json
import type { Meta } from './meta.js'

export interface GenerationBand {
  id: string
  min: number
  max: number
  probability: number
}

// attributeModifiers values are human-readable descriptions, not numbers.
// The engine uses them as documentation of the relationship, not as direct modifiers.
export interface BodyPart {
  id: string
  description: string
  generationBands: GenerationBand[]
  fragileThreshold: number
  attributeModifiers: Record<string, string>
}

export interface HealthData {
  meta: Meta
  bodyParts: BodyPart[]
}
