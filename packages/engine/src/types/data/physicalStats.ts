// Matches universal/physical-stats.json
import type { Meta } from './meta.js'

// Height bands carry an offset in cm — no attribute modifiers.
export interface HeightBand {
  id: string
  probability: number
  heightOffsetCm: number
}

// Reach bands carry a ratio multiplied against generated height.
export interface ReachBand {
  id: string
  probability: number
  ratioToHeight: number
  attributeModifiers: Record<string, number>
}

// All other physical profile bands carry attribute modifiers only.
export interface PhysicalBand {
  id: string
  probability: number
  attributeModifiers: Record<string, number>
}

export interface HeightProfile {
  note: string
  bands: HeightBand[]
  // Keyed by weight class id — base height in cm before band offset is applied.
  baseHeightByWeightClassCm: Record<string, number>
}

export interface ReachProfile {
  note: string
  bands: ReachBand[]
}

export interface PhysicalProfile {
  note: string
  bands: PhysicalBand[]
}

export interface PhysicalStatsData {
  meta: Meta
  heightProfile: HeightProfile
  reachProfile: ReachProfile
  handSizeProfile: PhysicalProfile
  neckThicknessProfile: PhysicalProfile
  boneDensityProfile: PhysicalProfile
  bodyProportionsProfile: PhysicalProfile
}
