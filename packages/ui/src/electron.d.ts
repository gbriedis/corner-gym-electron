// Type declaration for window.electronAPI exposed by the Electron preload script.
// The renderer never imports from Electron directly — it calls through this typed surface.

import type { GameConfig, WorldState, Person } from '@corner-gym/engine'

export interface SaveSummary {
  id: string
  saveName: string
  playerName: string
  gymName: string
  cityId: string
  nationId: string
  currentYear: number
  currentWeek: number
  seed: number
  difficulty: string
  createdAt: string
  lastPlayedAt: string
}

export interface CityOption {
  id: string
  label: string
  population: string
  isStartingOption: boolean
}

export interface DifficultyPreset {
  id: string
  label: string
  modifiers: {
    rentModifier: number
    talentDensity: number
    rivalGymDensity: number
    giftProbabilityMultiplier: number
    flawProbabilityMultiplier: number
    economicStatusWeightShift: number
    developmentProfileShift: number
  }
}

export interface NewGameOptions {
  defaults: {
    renderedNations: string[]
    startYear: number
    leagues: { amateur: boolean; pro: boolean }
    worldSettings: { populationPerCity: number; gymsPerCity: Record<string, number> }
  }
  difficulties: DifficultyPreset[]
  nationCities: Record<string, CityOption[]>
}

export interface ProgressEvent {
  step: string
  detail: string
  elapsedMs: number
}

declare global {
  interface Window {
    electronAPI: {
      getNewGameOptions(): Promise<NewGameOptions>
      generateAndSave(config: GameConfig): Promise<string>
      loadSave(saveId: string): Promise<{ worldState: WorldState; persons: Person[] }>
      listSaves(): Promise<SaveSummary[]>
      deleteSave(saveId: string): Promise<void>
      onGenerationProgress(callback: (data: ProgressEvent) => void): () => void
    }
  }
}
