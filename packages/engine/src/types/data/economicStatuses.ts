// Matches nations/latvia/economic-statuses.json
import type { Meta } from './meta.js'

export interface EconomicStatus {
  id: string
  label: string
  // Weights sum to 1.0 across all statuses.
  weight: number
  description: string
}

export interface EconomicStatusesData {
  meta: Meta
  statuses: EconomicStatus[]
}
