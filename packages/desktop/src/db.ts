// db.ts manages the SQLite database for Corner Gym save files.
//
// Schema uses normalised tables rather than a single blob for WorldState.
// Splitting persons into their own table allows querying by cityId, gymId,
// nationId, and age without deserialising the entire world state on every query.
// This becomes essential once the simulation needs to find fighters to schedule
// bouts, process aging, or scan for emerging talent within a specific city.

import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { join } from 'path'
import { app } from 'electron'

import type { WorldState } from '@corner-gym/engine'
import type { Person } from '@corner-gym/engine'
import type { GameConfig } from '@corner-gym/engine'

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

// openDb opens (or creates) the SQLite database file and initialises the schema.
// The database lives in the Electron user data directory so it survives app updates.
// Schema creation is idempotent — CREATE TABLE IF NOT EXISTS is safe to call on every launch.
export function openDb(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'corner-gym.db')
  const db = new Database(dbPath)

  // WAL mode improves read concurrency and is safer for desktop apps that may
  // be interrupted mid-write (e.g. OS forced close, power loss).
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS saves (
      id TEXT PRIMARY KEY,
      saveName TEXT NOT NULL,
      playerName TEXT NOT NULL,
      gymName TEXT NOT NULL,
      cityId TEXT NOT NULL,
      nationId TEXT NOT NULL,
      currentYear INTEGER NOT NULL,
      currentWeek INTEGER NOT NULL,
      seed INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      lastPlayedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS world_state (
      saveId TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS persons (
      id TEXT NOT NULL,
      saveId TEXT NOT NULL,
      data TEXT NOT NULL,
      cityId TEXT NOT NULL,
      gymId TEXT,
      nationId TEXT NOT NULL,
      age INTEGER NOT NULL,
      PRIMARY KEY (id, saveId),
      FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
    );
  `)

  return db
}

// createSave persists a newly generated world to the database and returns the saveId.
// All three tables are written in a single transaction — a partial write would leave
// the database in a state where world_state or persons rows exist without a matching
// saves row, breaking every foreign key query.
export function createSave(
  db: Database.Database,
  worldState: WorldState,
  persons: Person[],
  config: GameConfig,
): string {
  const saveId = randomUUID()
  const now = new Date().toISOString()

  const insertSave = db.prepare(`
    INSERT INTO saves (id, saveName, playerName, gymName, cityId, nationId,
      currentYear, currentWeek, seed, difficulty, createdAt, lastPlayedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertWorldState = db.prepare(`
    INSERT INTO world_state (saveId, data) VALUES (?, ?)
  `)

  const insertPerson = db.prepare(`
    INSERT INTO persons (id, saveId, data, cityId, gymId, nationId, age)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const saveName = `${config.playerName} — ${config.gymName}`

  const stateWithSaveId: WorldState = { ...worldState, saveId }

  db.transaction(() => {
    insertSave.run(
      saveId,
      saveName,
      config.playerName,
      config.gymName,
      config.playerCityId,
      config.playerNationId,
      config.startYear,
      1,
      config.seed,
      config.difficulty,
      now,
      now,
    )

    insertWorldState.run(saveId, JSON.stringify(stateWithSaveId))

    for (const person of persons) {
      // gymId: find which gym this person belongs to by scanning gym personIds
      const gymEntry = Object.entries(stateWithSaveId.gyms).find(([, gym]) =>
        gym.personIds.includes(person.id),
      )
      const gymId = gymEntry !== undefined ? gymEntry[0] : null

      insertPerson.run(
        person.id,
        saveId,
        JSON.stringify(person),
        person.cityId,
        gymId,
        person.nationId,
        person.age,
      )
    }
  })()

  return saveId
}

// loadSave retrieves a full world state and all persons for a given save slot.
// WorldState and persons are stored as JSON blobs — the columns on the persons
// table (cityId, gymId, nationId, age) exist for querying, not for reconstruction.
export function loadSave(
  db: Database.Database,
  saveId: string,
): { worldState: WorldState; persons: Person[] } {
  const worldRow = db
    .prepare('SELECT data FROM world_state WHERE saveId = ?')
    .get(saveId) as { data: string } | undefined

  if (worldRow === undefined) {
    throw new Error(`Save "${saveId}" not found`)
  }

  const personRows = db
    .prepare('SELECT data FROM persons WHERE saveId = ?')
    .all(saveId) as Array<{ data: string }>

  return {
    worldState: JSON.parse(worldRow.data) as WorldState,
    persons: personRows.map(r => JSON.parse(r.data) as Person),
  }
}

// listSaves returns all save summary rows for the load screen, ordered by most recently played.
export function listSaves(db: Database.Database): SaveSummary[] {
  return db
    .prepare('SELECT * FROM saves ORDER BY lastPlayedAt DESC')
    .all() as SaveSummary[]
}

// deleteSave removes a save and its associated world_state and persons rows.
// ON DELETE CASCADE handles the child rows automatically.
export function deleteSave(db: Database.Database, saveId: string): void {
  db.prepare('DELETE FROM saves WHERE id = ?').run(saveId)
}
