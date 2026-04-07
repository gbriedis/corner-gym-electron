// Matches nations/latvia/reasons-for-boxing.json
import type { Meta } from './meta.js'

export interface ReasonForBoxing {
  id: string
  label: string
  // Weights sum to 1.0 across all reasons.
  weight: number
  description: string
}

export interface ReasonsForBoxingData {
  meta: Meta
  reasons: ReasonForBoxing[]
}
