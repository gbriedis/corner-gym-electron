// GameConfig is passed to generateWorld() and drives all world generation decisions.
// It is never assumed or defaulted inside the engine — the caller always provides it explicitly.
// This keeps engine functions pure and testable without UI or default assumptions.

export interface LeagueSettings {
  amateur: boolean
  pro: boolean
}

export interface WorldSettings {
  // populationPerCity is keyed by city population type (small_town, mid_city, capital).
  // Tier-based counts reflect that a capital generates far more fighters than a small town.
  populationPerCity: Record<string, number>
  gymsPerCity: Record<string, number> // keyed by population type
}

// DifficultyModifiers contains all modifier fields at full precision.
// Used internally when the engine resolves a partial preset against 1.0 defaults.
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
  // Partial — only fields that differ from 1.0 need to be set.
  // generateWorld() resolves missing fields to 1.0 before use.
  difficultyModifiers: Partial<DifficultyModifiers>
  leagues: LeagueSettings
  worldSettings: WorldSettings
}

// resolveModifiers fills in 1.0 for any modifier field absent from the preset.
// Called at the top of generateWorld() so every engine path works with full values.
export function resolveModifiers(partial: Partial<DifficultyModifiers>): DifficultyModifiers {
  return {
    rentModifier:              partial.rentModifier              ?? 1.0,
    talentDensity:             partial.talentDensity             ?? 1.0,
    rivalGymDensity:           partial.rivalGymDensity           ?? 1.0,
    giftProbabilityMultiplier: partial.giftProbabilityMultiplier ?? 1.0,
    flawProbabilityMultiplier: partial.flawProbabilityMultiplier ?? 1.0,
    economicStatusWeightShift: partial.economicStatusWeightShift ?? 1.0,
    developmentProfileShift:   partial.developmentProfileShift   ?? 1.0,
  }
}
