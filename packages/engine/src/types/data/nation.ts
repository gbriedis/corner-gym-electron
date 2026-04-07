// Matches nations/latvia/nation.json — and any future nation bundle.
import type { Meta } from './meta.js'

// Partial overrides of physical-stats.json band probabilities for this nation.
// Only bands that differ from universal defaults are present — others are omitted.
export interface NationPhysicalProfile {
  note: string
  heightProfile?: Partial<Record<string, number>>
  reachProfile?: Partial<Record<string, number>>
  handSizeProfile?: Partial<Record<string, number>>
  neckThicknessProfile?: Partial<Record<string, number>>
  boneDensityProfile?: Partial<Record<string, number>>
  bodyProportionsProfile?: Partial<Record<string, number>>
}

export interface NationData {
  meta: Meta
  id: string
  label: string
  region: string
  // 1-5 scale: how embedded boxing is in the national consciousness.
  boxingCulture: number
  description: string
  regionalTagsAvailable: string[]
  namePoolReference: string
  physicalProfile: NationPhysicalProfile
}
