// Matches nations/latvia/nation.json and nations/usa/nation.json.
// Fields that are Latvia-specific are optional so new nations can omit them.
import type { Meta } from './meta.js'

// Partial overrides of physical-stats.json band probabilities for this nation.
// Only bands that differ from universal defaults are present — others are omitted.
// Nations that drive physical variation via ethnicity biases (USA) leave all
// profile fields absent — mergeNationProbabilities handles undefined gracefully.
export interface NationPhysicalProfile {
  note: string
  heightProfile?: Partial<Record<string, number>>
  reachProfile?: Partial<Record<string, number>>
  handSizeProfile?: Partial<Record<string, number>>
  neckThicknessProfile?: Partial<Record<string, number>>
  boneDensityProfile?: Partial<Record<string, number>>
  bodyProportionsProfile?: Partial<Record<string, number>>
}

export interface NationPhysicalStatsProfile {
  heightCmMale?: { mean: number; stdDev: number }
  weightKgAtFlyweight?: { mean: number; stdDev: number }
  reachCmBias?: number
  note?: string
}

export interface NationPerformanceHint {
  estimatedFighters: number
  estimatedGyms: number
  estimatedGenerationSeconds: number
}

export interface NationData {
  meta: Meta
  id: string
  label: string
  boxingCulture: number
  // Latvia-style fields — optional for nations like USA that use a different model.
  region?: string
  description?: string
  regionalTagsAvailable?: string[]
  namePoolReference?: string
  physicalProfile?: NationPhysicalProfile
  // USA-style fields — optional for nations like Latvia.
  demonym?: string
  language?: string
  currency?: string
  proEcosystemStartLevel?: number
  physicalStatsProfile?: NationPhysicalStatsProfile
  performanceHint?: NationPerformanceHint
}
