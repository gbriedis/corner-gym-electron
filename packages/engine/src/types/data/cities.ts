// Matches nations/latvia/cities.json
import type { Meta } from './meta.js'

export type PopulationType = 'small_town' | 'mid_city' | 'capital'
export type RegionTag = 'rural' | 'urban' | 'coastal' | 'industrial' | 'high_altitude'
export type BoxingActivityLevel = 'low' | 'medium' | 'high'

export interface EventHostingFrequencyRange {
  min: number
  max: number
}

// Per-circuit event hosting frequency for a city. Only club_tournament and
// regional_open are hosted locally — national and above are assigned by
// the federation rotation and are not city-owned decisions.
export interface EventHostingFrequency {
  club_tournament?: EventHostingFrequencyRange
  regional_open?: EventHostingFrequencyRange
}

export interface City {
  id: string
  label: string
  regionTag: RegionTag
  population: PopulationType
  isStartingOption: boolean
  // Informational level used by UI to set tone for this city.
  boxingActivityLevel: BoxingActivityLevel
  // Per-event-type frequency ranges. Engine reads these instead of guessing.
  eventHostingFrequency: EventHostingFrequency
  // All modifiers are relative to baseline 1.0.
  rentModifier: number
  talentDensity: number
  rivalGymDensity: number
  description: string
}

export interface CitiesData {
  meta: Meta
  cities: City[]
}
