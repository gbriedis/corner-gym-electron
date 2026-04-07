// GameConfig is passed to generateWorld() and drives all world generation decisions.
// It is never assumed or defaulted inside the engine — the caller always provides it explicitly.
// This keeps engine functions pure and testable without UI or default assumptions.

export interface LeagueSettings {
  amateur: boolean
  pro: boolean
}

export interface WorldSettings {
  populationPerCity: number
  gymsPerCity: Record<string, number> // keyed by population type (small_town, mid_city, capital)
}

export interface DifficultyModifiers {
  rentModifier: number
  talentDensity: number
  rivalGymDensity: number
  giftProbabilityMultiplier: number
  flawProbabilityMultiplier: number
  economicStatusWeightShift: number
  developmentProfileShift: number
}

export interface GameConfig {
  seed: number
  startYear: number
  playerName: string
  gymName: string
  playerCityId: string
  playerNationId: string
  renderedNations: string[]
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme'
  difficultyModifiers: DifficultyModifiers
  leagues: LeagueSettings
  worldSettings: WorldSettings
}
