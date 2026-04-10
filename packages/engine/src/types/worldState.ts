// WorldState is the complete generated world. It is serialised to SQLite after generation
// and deserialised when loading a save. All simulation functions receive WorldState.

import type { Gym } from './gym.js'

export interface CityState {
  cityId: string
  nationId: string
  gymIds: string[]
}

export interface NationState {
  nationId: string
  cityIds: string[]
}

export interface WorldState {
  saveId: string
  seed: number
  currentYear: number
  currentWeek: number
  playerName: string
  gymName: string
  playerGymId: string
  playerCityId: string
  playerNationId: string
  nations: Record<string, NationState>
  cities: Record<string, CityState>
  // Full Gym objects keyed by gym id — memberIds and fighterIds are arrays of person/fighter ids.
  // Actual Person and Fighter records live in the SQLite persons table.
  gyms: Record<string, Gym>
  // persons stored separately in SQLite persons table — not embedded here
  // rotationIndices tracks the current host-city rotation position for each
  // event template that uses hostCityRotation (keyed by templateId).
  // Stored in WorldState so the index survives save/load cycles.
  rotationIndices: Record<string, number>
}
