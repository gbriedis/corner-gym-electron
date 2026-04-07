// WorldState is the complete generated world. It is serialised to SQLite after generation
// and deserialised when loading a save. All simulation functions receive WorldState.

export interface GymState {
  id: string
  name: string
  cityId: string
  nationId: string
  isPlayerGym: boolean
  reputation: number  // 0-100
  personIds: string[] // references persons in the save
}

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
  gyms: Record<string, GymState>
  // persons stored separately in SQLite persons table — not embedded here
}
