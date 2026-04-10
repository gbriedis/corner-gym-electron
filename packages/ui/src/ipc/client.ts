// Typed wrappers around window.electronAPI.
// All renderer→main IPC calls go through here — never call window.electronAPI directly
// from components so call sites are easy to stub in tests and easy to find when the
// IPC contract changes.

import type { GameConfig, WorldState, Person, CalendarEvent, GameData } from '@corner-gym/engine'
import type { SaveSummary, NewGameOptions, ProgressEvent, BackrunProgressEvent } from '../electron'

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
