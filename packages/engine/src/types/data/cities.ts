// Matches nations/latvia/cities.json
import type { Meta } from './meta.js'

export type PopulationType = 'small_town' | 'mid_city' | 'capital'
export type RegionTag = 'rural' | 'urban' | 'coastal' | 'industrial' | 'high_altitude'

export interface City {
  id: string
  label: string
  regionTag: RegionTag
  population: PopulationType
  isStartingOption: boolean
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
