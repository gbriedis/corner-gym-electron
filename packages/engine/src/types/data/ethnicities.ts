// Matches nations/usa/ethnicities.json structure.
// Ethnicity is optional per nation — Latvia has no ethnicities file.
// EthnicitiesData is loaded when nations/[id]/ethnicities.json exists.
import type { Meta } from './meta.js'

export interface EthnicityPhysicalProfile {
  heightBias?: number      // multiplier on mean height
  reachBias?: number       // multiplier on reach relative to height
  weightBias?: number      // multiplier on natural weight
  handSpeedBias?: number   // multiplier on hand_speed generation ceiling
  powerBias?: number       // multiplier on power generation ceiling
  chinBias?: number        // multiplier on chin generation ceiling
  durabilityBias?: number  // multiplier on durability generation ceiling
  staminaBias?: number     // multiplier on stamina generation ceiling
}

export interface Ethnicity {
  id: string
  label: string
  // Probability of this ethnicity for persons generated in each city.
  // Only cities with meaningful presence are listed.
  cityWeights: Record<string, number>
  // Multipliers on base soul trait probabilities. 1.4 = 40% more likely.
  soulTraitWeights: Record<string, number>
  // Multipliers on base reason-for-boxing probabilities.
  reasonForBoxingWeights: Record<string, number>
  // Multipliers on base style tendency probabilities.
  styleTendencyWeights: Record<string, number>
  // Biases applied to generation ceilings — never push above absoluteMax.
  physicalProfile: EthnicityPhysicalProfile
}

export interface EthnicitiesData {
  meta: Meta
  ethnicities: Ethnicity[]
}
