// Typed wrappers around window.electronAPI.
// All renderer→main IPC calls go through here — never call window.electronAPI directly
// from components so call sites are easy to stub in tests and easy to find when the
// IPC contract changes.

import type { GameConfig, WorldState, Person, CalendarEvent, GameData } from '@corner-gym/engine'
import type {
  SaveSummary, NewGameOptions, ProgressEvent, BackrunProgressEvent,
  WorldDevSummary, FighterListItem, FighterDevDetail, AttributeDistributionResult,
  BoutLogEntry, BoutLogSummary, GymFinancialDetail, GymListItem,
  DevFighterFilters, DevBoutFilters,
} from '../electron'

export async function generateAndSave(config: GameConfig): Promise<string> {
  return window.electronAPI.generateAndSave(config)
}

export async function loadSave(saveId: string): Promise<{ worldState: WorldState; persons: Person[] }> {
  return window.electronAPI.loadSave(saveId)
}

export async function listSaves(): Promise<SaveSummary[]> {
  return window.electronAPI.listSaves()
}

export async function deleteSave(saveId: string): Promise<void> {
  return window.electronAPI.deleteSave(saveId)
}

export async function getNewGameOptions(): Promise<NewGameOptions> {
  return window.electronAPI.getNewGameOptions()
}

export function onGenerationProgress(callback: (data: ProgressEvent) => void): () => void {
  return window.electronAPI.onGenerationProgress(callback)
}

export function onBackrunProgress(callback: (data: BackrunProgressEvent) => void): () => void {
  return window.electronAPI.onBackrunProgress(callback)
}

export async function getUpcomingEvents(
  saveId: string,
  currentWeek: number,
  currentYear: number,
): Promise<CalendarEvent[]> {
  return window.electronAPI.getUpcomingEvents(saveId, currentWeek, currentYear)
}

export async function getAllEvents(saveId: string): Promise<CalendarEvent[]> {
  return window.electronAPI.getAllEvents(saveId)
}

export async function getGameData(): Promise<GameData> {
  return window.electronAPI.getGameData()
}

export async function devWorldSummary(saveId: string): Promise<WorldDevSummary | null> {
  return window.electronAPI.devWorldSummary(saveId)
}

export async function devFighterList(
  saveId: string,
  filters: DevFighterFilters,
): Promise<{ fighters: FighterListItem[]; total: number }> {
  return window.electronAPI.devFighterList(saveId, filters)
}

export async function devFighterDetail(
  saveId: string,
  fighterId: string,
): Promise<FighterDevDetail | null> {
  return window.electronAPI.devFighterDetail(saveId, fighterId)
}

export async function devAttributeDistribution(
  saveId: string,
  attributeId: string,
  nationId: string | null,
): Promise<AttributeDistributionResult> {
  return window.electronAPI.devAttributeDistribution(saveId, attributeId, nationId)
}

export async function devBoutLog(
  saveId: string,
  filters: DevBoutFilters,
): Promise<{ bouts: BoutLogEntry[]; summary: BoutLogSummary }> {
  return window.electronAPI.devBoutLog(saveId, filters)
}

export async function devGymFinancials(
  saveId: string,
  gymId: string,
): Promise<GymFinancialDetail | null> {
  return window.electronAPI.devGymFinancials(saveId, gymId)
}

export async function devGymList(saveId: string): Promise<GymListItem[]> {
  return window.electronAPI.devGymList(saveId)
}
