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

// ─── Dev Mode Types ───────────────────────────────────────────────────────────

export interface NationDevSummary {
  nationId: string
  personCount: number
  gymCount: number
  fighterCount: number
  competingCount: number
  retiredCount: number
  boutCount: number
}

export interface WorldDevSummary {
  seed: number
  currentYear: number
  renderedNations: string[]
  nationSummaries: NationDevSummary[]
  weightClassDistribution: Array<{ weightClassId: string; count: number }>
}

export interface FighterListItem {
  id: string
  firstName: string
  surname: string
  cityId: string
  nationId: string
  identityState: string
  weightClassId: string
  wins: number
  losses: number
  kos: number
  age: number
  readiness: number
}

export interface DevSoulTrait {
  traitId: string
}

export interface DevDevelopedAttribute {
  attributeId: string
  current: number
  ceiling: number
}

export interface DevPhysicalProfile {
  heightCm: number
  reachCm: number
  weightKg: number
  handSize: string
  neckThickness: string
  boneDensity: string
  bodyProportions: string
}

export interface DevBoutRecord {
  year: number
  week: number
  opponentName: string
  result: 'W' | 'L' | 'D'
  method: string
  endRound: number
}

export interface FighterDevDetail {
  id: string
  firstName: string
  surname: string
  age: number
  nationId: string
  cityId: string
  gymId: string | null
  gymName: string | null
  identityState: string
  stateChangedYear: number
  stateChangedWeek: number
  weightClassId: string
  competitionStatus: string
  wins: number
  losses: number
  kos: number
  southpaw: boolean
  styleTendency: string
  tendencyStrength: number
  soulTraits: DevSoulTrait[]
  developedAttributes: DevDevelopedAttribute[]
  physicalProfile: DevPhysicalProfile
  coachQuality: number | null
  lastBouts: DevBoutRecord[]
}

export interface DistributionStats {
  mean: number
  median: number
  min: number
  max: number
  stdDev: number
}

export interface AttributeDistributionResult {
  attribute: string
  distribution: number[]
  stats: DistributionStats
}

export interface BoutLogEntry {
  boutId: string
  year: number
  week: number
  circuitLevel: string
  fighterAName: string
  fighterBName: string
  winnerId: string | null
  method: string
  endRound: number
  scheduledRounds: number
}

export interface BoutLogSummary {
  total: number
  koTko: number
  decision: number
  splitMajority: number
  avgEndRound: number
  avgScheduledRounds: number
}

export interface GymEquipmentSummary {
  typeId: string
  instanceCount: number
  avgCondition: number
}

export interface DevGymRevenueRecord {
  year: number
  week: number
  income: number
  outgoings: number
  balance: number
  note: string
}

export interface GymFinancialDetail {
  gymId: string
  name: string
  cityId: string
  nationId: string
  gymTier: string
  balance: number
  monthlyRent: number
  memberCount: number
  fighterCount: number
  revenueHistory: DevGymRevenueRecord[]
  equipment: GymEquipmentSummary[]
}

export interface GymListItem {
  id: string
  name: string
  cityId: string
  nationId: string
}

export interface DevFighterFilters {
  nationId?: string
  cityId?: string
  identityState?: string
  weightClassId?: string
  sortBy?: 'wins' | 'readiness' | 'age' | 'attributeTotal'
}

export interface DevBoutFilters {
  method?: string
  limit?: number
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
      // Dev mode
      devWorldSummary(saveId: string): Promise<WorldDevSummary | null>
      devFighterList(saveId: string, filters: DevFighterFilters): Promise<{ fighters: FighterListItem[]; total: number }>
      devFighterDetail(saveId: string, fighterId: string): Promise<FighterDevDetail | null>
      devAttributeDistribution(saveId: string, attributeId: string, nationId: string | null): Promise<AttributeDistributionResult>
      devBoutLog(saveId: string, filters: DevBoutFilters): Promise<{ bouts: BoutLogEntry[]; summary: BoutLogSummary }>
      devGymFinancials(saveId: string, gymId: string): Promise<GymFinancialDetail | null>
      devGymList(saveId: string): Promise<GymListItem[]>
    }
  }
}
