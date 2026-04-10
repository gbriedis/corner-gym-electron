// Type declaration for window.electronAPI exposed by the Electron preload script.
// The renderer never imports from Electron directly — it calls through this typed surface.

import type { GameConfig, WorldState, Person, CalendarEvent, GameData } from '@corner-gym/engine'

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
  // Partial — normal difficulty has empty modifiers; engine resolves absent fields to 1.0.
  modifiers: Partial<{
    rentModifier: number
    talentDensity: number
    rivalGymDensity: number
    giftProbabilityMultiplier: number
    flawProbabilityMultiplier: number
    economicStatusWeightShift: number
    developmentProfileShift: number
  }>
}

export interface NationOption {
  id: string
  label: string
  estimatedFighters: number
  estimatedGenerationSeconds: number
}

export interface NewGameOptions {
  defaults: {
    renderedNations: string[]
    startYear: number
    leagues: { amateur: boolean; pro: boolean }
    worldSettings: { populationPerCity: Record<string, number>; gymsPerCity: Record<string, number> }
  }
  difficulties: DifficultyPreset[]
  nationCities: Record<string, CityOption[]>
  // All available nations with their performance hints for world configuration UI.
  availableNations: NationOption[]
}

export interface ProgressEvent {
  step: string
  detail: string
  elapsedMs: number
}

export interface BackrunProgressEvent {
  year: number
  boutsSimulated: number
  identityTransitions: number
  message: string
  percent: number
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
      onBackrunProgress(callback: (data: BackrunProgressEvent) => void): () => void
      getUpcomingEvents(saveId: string, currentWeek: number, currentYear: number): Promise<CalendarEvent[]>
      getAllEvents(saveId: string): Promise<CalendarEvent[]>
      getGameData(): Promise<GameData>
    }
  }
}
