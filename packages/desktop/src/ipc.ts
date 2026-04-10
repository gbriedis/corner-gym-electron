// ipc.ts wires all IPC handlers between the Electron main process and the renderer.
// Each handler receives typed data from the preload bridge and returns typed results.
// World generation is synchronous here — the UI shows a spinner fed by progress events.

import { ipcMain } from 'electron'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import type { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import type { GameConfig } from '@corner-gym/engine'

import { loadGameData, generateWorld, runBackrun } from '@corner-gym/engine'
import type { YearEndBatch } from '@corner-gym/engine'
import { createSave, loadSave, listSaves, deleteSave, saveCalendar, getUpcomingEvents, loadCalendar, saveGyms, saveCoaches, updateFighter, updateGym, saveBoutResult } from './db.js'
import {
  getDevWorldSummary, getDevFighterList, getDevFighterDetail,
  getDevAttributeDistribution, getDevBoutLog, getDevGymFinancials, getDevGymList,
} from './db-dev.js'
import type { DevFighterFilters, DevBoutFilters } from './db-dev.js'

// batchWriteBackrun persists one year of accumulated simulation changes to SQLite.
// Each batch contains only the records that changed during that year — we don't
// rewrite the entire world, only the fighters and gyms that were touched.
// Running inside a transaction ensures each year is all-or-nothing.
function batchWriteBackrun(db: Database.Database, batch: YearEndBatch): void {
  db.transaction(() => {
    for (const boutResult of batch.pendingBoutResults) {
      saveBoutResult(db, batch.saveId, boutResult)
    }

    for (const fighterId of batch.pendingFighterUpdates) {
      const fighter = batch.fighters.get(fighterId)
      if (fighter !== undefined) {
        updateFighter(db, batch.saveId, fighter)
      }
    }

    for (const gymId of batch.pendingGymUpdates) {
      const gym = batch.gyms.get(gymId)
      if (gym !== undefined) {
        updateGym(db, batch.saveId, gym)
      }
    }
  })()
}

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
  // Returns the rendered nations, their starting cities, difficulty presets,
  // all available nations (for world configuration), and config defaults.
  // The UI builds the full GameConfig from this data before submitting.
  ipcMain.handle('get-new-game-options', () => {
    const defaults = JSON.parse(
      readFileSync(join(DATA_ROOT, 'universal/game-config-defaults.json'), 'utf-8'),
    ) as { renderedNations: string[] }

    const difficultiesRaw = JSON.parse(
      readFileSync(join(DATA_ROOT, 'universal/difficulties.json'), 'utf-8'),
    ) as { difficulties: Array<{ id: string; label: string; modifiers: Record<string, number> }> }

    // Discover all available nation folders for world configuration UI.
    const nationsDir = join(DATA_ROOT, 'nations')
    const nationFolders = readdirSync(nationsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)

    const availableNations: Array<{ id: string; label: string; estimatedFighters: number; estimatedGenerationSeconds: number }> = []
    const nationCities: Record<string, Array<{ id: string; label: string; population: string; isStartingOption: boolean }>> = {}

    for (const nationId of nationFolders) {
      const nationPath = join(nationsDir, nationId, 'nation.json')
      if (!existsSync(nationPath)) continue
      const nationRaw = JSON.parse(readFileSync(nationPath, 'utf-8')) as {
        label?: string
        performanceHint?: { estimatedFighters: number; estimatedGenerationSeconds: number }
      }
      availableNations.push({
        id: nationId,
        label: nationRaw.label ?? nationId,
        estimatedFighters: nationRaw.performanceHint?.estimatedFighters ?? 0,
        estimatedGenerationSeconds: nationRaw.performanceHint?.estimatedGenerationSeconds ?? 1,
      })

      // Load city data so the UI can populate the city dropdown for any selected nation.
      const citiesPath = join(nationsDir, nationId, 'cities.json')
      if (existsSync(citiesPath)) {
        const citiesRaw = JSON.parse(readFileSync(citiesPath, 'utf-8')) as {
          cities: Array<{ id: string; label: string; population: string; isStartingOption?: boolean }>
        }
        nationCities[nationId] = citiesRaw.cities.map(c => ({
          ...c,
          isStartingOption: c.isStartingOption ?? true,
        }))
      }
    }

    return {
      defaults,
      difficulties: difficultiesRaw.difficulties,
      nationCities,
      availableNations,
    }
  })

  // ipc: generate-and-save
  // Receives a fully resolved GameConfig from the UI. Loads game data, generates
  // the world, runs a 10-year backrun to populate history, then persists the final
  // state to SQLite. Progress events are emitted throughout so the loading screen
  // stays alive with meaningful feedback.
  ipcMain.handle('generate-and-save', async (_event, config: GameConfig) => {
    const startMs = Date.now()

    emit('Loading game data', 'Initialising engine data…', startMs)
    const data = loadGameData()

    // Per-city progress events so the loading spinner feels alive during world gen.
    for (const nationId of config.renderedNations) {
      const bundle = data.nations[nationId]
      if (bundle === undefined) continue
      for (const city of bundle.cities.cities) {
        emit('Generating population', `${city.label}…`, startMs)
      }
    }

    emit('Generating world', 'Building gyms and world state…', startMs)
    const { worldState, persons, fighters, gyms, coaches, calendar } = generateWorld(config, data)

    emit('Saving to database', 'Writing save file…', startMs)
    const saveId = createSave(db, worldState, persons, config)
    saveCalendar(db, saveId, calendar)
    saveGyms(db, saveId, gyms)
    saveCoaches(db, saveId, coaches)

    // Run the backrun — 520 weeks of history before the player arrives.
    // Year-end batches write only changed records so we don't rewrite the full world each year.
    // Progress events are forwarded to the renderer via backrun-progress IPC.
    emit('Generating world history', 'Simulating 10 years of boxing history…', startMs)

    await runBackrun(
      worldState,
      persons,
      fighters,
      gyms,
      coaches,
      calendar,
      data,
      config,
      saveId,
      (batch: YearEndBatch) => {
        batchWriteBackrun(db, batch)
      },
      (progress) => {
        const pct = Math.round(((progress.year - (config.startYear - 10)) / 10) * 100)
        win.webContents.send('backrun-progress', { ...progress, percent: pct })
        emit(
          'Generating world history',
          `Year ${progress.year} · ${progress.boutsSimulated} bouts simulated`,
          startMs,
        )
      },
    )

    emit('Done', `World ready in ${Date.now() - startMs}ms`, startMs)

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

  // ─── Dev mode IPC ─────────────────────────────────────────────────────────
  // All dev handlers require a saveId — return null gracefully if no save is loaded.

  // ipc: dev-world-summary
  // Returns aggregate stats per nation plus weight class distribution.
  // Requires deserialising all fighter blobs — ~5k rows max, acceptable for a dev tool.
  ipcMain.handle('dev-world-summary', (_event, saveId: string) => {
    return getDevWorldSummary(db, saveId)
  })

  // ipc: dev-fighter-list
  // Returns all fighters matching the given filters, sorted for the browser table.
  ipcMain.handle('dev-fighter-list', (_event, saveId: string, filters: DevFighterFilters) => {
    return getDevFighterList(db, saveId, filters)
  })

  // ipc: dev-fighter-detail
  // Returns the full dev view of a single fighter — all soul traits revealed, no ocean rule.
  ipcMain.handle('dev-fighter-detail', (_event, saveId: string, fighterId: string) => {
    return getDevFighterDetail(db, saveId, fighterId)
  })

  // ipc: dev-attribute-distribution
  // Returns a histogram of current values for one attribute across all fighters.
  ipcMain.handle('dev-attribute-distribution', (
    _event,
    saveId: string,
    attributeId: string,
    nationId: string | null,
  ) => {
    return getDevAttributeDistribution(db, saveId, attributeId, nationId)
  })

  // ipc: dev-bout-log
  // Returns the last N resolved bouts with summary percentages.
  // The summary KO% / decision% are the primary simulation health check.
  ipcMain.handle('dev-bout-log', (_event, saveId: string, filters: DevBoutFilters) => {
    return getDevBoutLog(db, saveId, filters)
  })

  // ipc: dev-gym-financials
  // Returns the financial history and equipment state for a single gym.
  ipcMain.handle('dev-gym-financials', (_event, saveId: string, gymId: string) => {
    return getDevGymFinancials(db, saveId, gymId)
  })

  // ipc: dev-gym-list
  // Returns all gyms for a save — used to populate the gym selector dropdown.
  ipcMain.handle('dev-gym-list', (_event, saveId: string) => {
    return getDevGymList(db, saveId)
  })
}
