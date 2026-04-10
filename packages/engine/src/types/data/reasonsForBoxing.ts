// Matches nations/latvia/reasons-for-boxing.json, nations/usa/reasons-for-boxing.json,
// and universal/reasons-for-boxing.json.
// The universal file adds extra metadata fields for future systems (moment, ambition).
import type { Meta } from './meta.js'

export interface ReasonForBoxing {
  id: string
  label: string
  description: string
  // Present in nation-specific files. Absent in universal definitions file.
  weight?: number
  // Future-system metadata. Present in universal/reasons-for-boxing.json.
  soulTraitAffinities?: string[]
  soulTraitRisks?: string[]
  ambitionBias?: string
  note?: string
}

export interface ReasonsForBoxingData {
  meta: Meta
  reasons: ReasonForBoxing[]
}
