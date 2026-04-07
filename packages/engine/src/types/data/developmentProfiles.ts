// Matches universal/development-profiles.json
import type { Meta } from './meta.js'

export interface AgeRange {
  min: number
  max: number
}

export interface DevelopmentProfile {
  id: string
  label: string
  // Probability weight used at generation — profiles sum to 1.0.
  probability: number
  // Rolled at generation to produce the person's specific peak age.
  peakAgeRange: AgeRange
  // How much ageFactor increases per year before peak.
  riseRate: number
  // How many years the person stays near peak (ageFactor > 0.95) after reaching it.
  plateauDuration: number
  // How much ageFactor decreases per year after the plateau ends.
  declineRate: number
  description: string
}

export interface DevelopmentProfilesData {
  meta: Meta
  profiles: DevelopmentProfile[]
}
