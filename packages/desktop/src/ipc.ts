// ipc.ts wires all IPC handlers between the Electron main process and the renderer.
// Each handler receives typed data from the preload bridge and returns typed results.
// World generation is synchronous here — the UI shows a spinner fed by progress events.

import { ipcMain } from 'electron'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import type { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import type { GameConfig } from '@corner-gym/engine'

import { loadGameData, generateWorld } from '@corner-gym/engine'
import { createSave, loadSave, listSaves, deleteSave, saveCalendar, getUpcomingEvents, loadCalendar, saveGyms, saveCoaches } from './db.js'

// ESM does not have __dirname — derive it from import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url))

// DATA_ROOT resolves to packages/engine/data/ from the compiled desktop dist/.
// We read game-config-defaults.json and difficulties.json directly here
// because these files inform the UI before world generation begins —
// they do not need to be part of the engine's GameData object.
const DATA_ROOT = join(__dirname, '../../engine/data')

interface ProgressEvent {
  step: string
  detail: string
  elapsedMs: number
}

export function setupIpc(db: Database.Database, win: BrowserWindow): void {
  function emit(step: string, detail: string, startMs: number): void {
    const event: ProgressEvent = { step, detail, elapsedMs: Date.now() - startMs }
    win.webContents.send('generation-progress', event)
  }

  // ipc: get-new-game-options
  // Returns the rendered nations, their starting cities, difficulty presets, and
  // config defaults for the new game form. The UI builds the full GameConfig from
  // this data before submitting — nothing is hardcoded in the renderer.
  ipcMain.handle('get-new-game-options', () => {
    const defaults = JSON.parse(
      readFileSync(join(DATA_ROOT, 'universal/game-config-defaults.json'), 'utf-8'),
    ) as { renderedNations: string[] }

    const difficultiesRaw = JSON.parse(
      readFileSync(join(DATA_ROOT, 'universal/difficulties.json'), 'utf-8'),
    ) as { difficulties: Array<{ id: string; label: string; modifiers: Record<string, number> }> }

    // Load city data for each rendered nation so the UI can populate the city dropdown.
    const nationCities: Record<string, Array<{ id: string; label: string; population: string; isStartingOption: boolean }>> = {}
    for (const nationId of defaults.renderedNations) {
      const citiesRaw = JSON.parse(
        readFileSync(join(DATA_ROOT, `nations/${nationId}/cities.json`), 'utf-8'),
      ) as { cities: Array<{ id: string; label: string; population: string; isStartingOption: boolean }> }
      nationCities[nationId] = citiesRaw.cities
    }

    return {
      defaults,
      difficulties: difficultiesRaw.difficulties,
      nationCities,
    }
  })

  // ipc: generate-and-save
  // Receives a fully resolved GameConfig from the UI. Loads game data, generates
  // the world, persists it to SQLite, and returns the saveId. Progress events are
  // emitted per city so the loading spinner shows live feedback.
  ipcMain.handle('generate-and-save', async (_event, config: GameConfig) => {
    const startMs = Date.now()

    emit('Loading game data', 'Initialising engine data…', startMs)
    const data = loadGameData()

    // Emit one progress event per city so the loading screen feels alive.
    // We patch the generation to emit after each city by splitting the call
    // into per-city progress points before the full generateWorld call.
    // generateWorld is called once with the full config — the city-level
    // events are approximated from the nation bundles already in data.
    for (const nationId of config.renderedNations) {
      const bundle = data.nations[nationId]
      if (bundle === undefined) continue
      for (const city of bundle.cities.cities) {
        emit('Generating population', `${city.label}…`, startMs)
      }
    }

    emit('Generating world', 'Building gyms and world state…', startMs)
    const { worldState, persons, gyms, coaches, calendar } = generateWorld(config, data)

    emit('Saving to database', 'Writing save file…', startMs)
    const saveId = createSave(db, worldState, persons, config)
    saveCalendar(db, saveId, calendar)
    saveGyms(db, saveId, gyms)
    saveCoaches(db, saveId, coaches)

    emit('Done', `Save created in ${Date.now() - startMs}ms`, startMs)

    return saveId
  })

  // ipc: load-save
  // Returns WorldState and persons for a given saveId. Used when the player
  // selects a save from the load screen.
  ipcMain.handle('load-save', (_event, saveId: string) => {
    return loadSave(db, saveId)
  })

  // ipc: list-saves
  // Returns all SaveSummary entries ordered by most recently played.
  ipcMain.handle('list-saves', () => {
    return listSaves(db)
  })

  // ipc: delete-save
  // Removes a save and all associated data from the database.
  ipcMain.handle('delete-save', (_event, saveId: string) => {
    deleteSave(db, saveId)
  })

  // ipc: get-upcoming-events
  // Returns calendar events for the next 52 weeks from the current position.
  // Used by the Calendar screen to show a full-year forward view.
  ipcMain.handle('get-upcoming-events', (_event, saveId: string, currentWeek: number, currentYear: number) => {
    return getUpcomingEvents(db, saveId, currentWeek, currentYear, 52)
  })

  // ipc: get-all-events
  // Returns every calendar event for a save ordered by year then week.
  // Used by the Calendar month grid which needs the full generated window
  // (start year + next year) without a recency filter.
  ipcMain.handle('get-all-events', (_event, saveId: string) => {
    return loadCalendar(db, saveId)
  })

  // ipc: get-game-data
  // Returns the full loaded GameData. Called once after a save loads so the
  // UI can cache static game data (venues, rules, circuits) in the Zustand store
  // and pages can read it without per-navigation IPC calls.
  ipcMain.handle('get-game-data', () => {
    return loadGameData()
  })
}
