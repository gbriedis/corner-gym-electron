// Typed wrappers around window.electronAPI.
// All renderer→main IPC calls go through here — never call window.electronAPI directly
// from components so call sites are easy to stub in tests and easy to find when the
// IPC contract changes.

import type { GameConfig, WorldState, Person } from '@corner-gym/engine'
import type { SaveSummary, NewGameOptions, ProgressEvent } from '../electron'

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
