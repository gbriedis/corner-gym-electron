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

import type { WorldState, Person, GameConfig } from '@corner-gym/engine'
import type { CalendarEvent, EventStatus } from '@corner-gym/engine'
import type { Bout, BoutResult, Card, TournamentBracket, MultiDayEvent } from '@corner-gym/engine'

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

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT NOT NULL,
      saveId TEXT NOT NULL,
      templateId TEXT NOT NULL,
      circuitLevel TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL,
      venueId TEXT NOT NULL,
      venueName TEXT NOT NULL DEFAULT '',
      venueCapacity INTEGER NOT NULL DEFAULT 0,
      cityId TEXT NOT NULL,
      countryDisplay TEXT,
      nationId TEXT NOT NULL,
      year INTEGER NOT NULL,
      week INTEGER NOT NULL,
      weightClasses TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      boutIds TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (id, saveId),
      FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bouts (
      id TEXT NOT NULL,
      saveId TEXT NOT NULL,
      eventId TEXT NOT NULL,
      circuitLevel TEXT NOT NULL,
      weightClassId TEXT NOT NULL,
      ageCategoryId TEXT NOT NULL,
      fighterAId TEXT NOT NULL,
      fighterBId TEXT NOT NULL,
      gymAId TEXT NOT NULL,
      gymBId TEXT NOT NULL,
      scheduledRounds INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      result TEXT,
      PRIMARY KEY (id, saveId),
      FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT NOT NULL,
      saveId TEXT NOT NULL,
      eventId TEXT NOT NULL,
      boutIds TEXT NOT NULL DEFAULT '[]',
      visibility TEXT NOT NULL DEFAULT 'private',
      PRIMARY KEY (id, saveId),
      FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tournament_brackets (
      id TEXT NOT NULL,
      saveId TEXT NOT NULL,
      eventId TEXT NOT NULL,
      weightClassId TEXT NOT NULL,
      ageCategoryId TEXT NOT NULL,
      entrants TEXT NOT NULL DEFAULT '[]',
      rounds TEXT NOT NULL DEFAULT '[]',
      winnerId TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      PRIMARY KEY (id, saveId),
      FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS multi_day_events (
      eventId TEXT NOT NULL,
      saveId TEXT NOT NULL,
      days TEXT NOT NULL DEFAULT '[]',
      PRIMARY KEY (eventId, saveId),
      FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
    );
  `)

  // Schema migrations — each ALTER TABLE is wrapped in try/catch so the operation
  // is idempotent on existing databases. SQLite does not support ADD COLUMN IF NOT EXISTS.
  const migrations = [
    `ALTER TABLE calendar_events ADD COLUMN venueName TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE calendar_events ADD COLUMN venueCapacity INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE calendar_events ADD COLUMN countryDisplay TEXT`,
    `ALTER TABLE calendar_events ADD COLUMN name TEXT NOT NULL DEFAULT ''`,
  ]
  for (const sql of migrations) {
    try {
      db.exec(sql)
    } catch {
      // Column already exists — no action needed.
    }
  }

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

// saveCalendar inserts all calendar events for a save in a single transaction.
// weightClasses and boutIds are serialised as JSON arrays — SQLite has no array type,
// and JSON serialisation keeps reconstruction trivial without a join table.
export function saveCalendar(
  db: Database.Database,
  saveId: string,
  events: CalendarEvent[],
): void {
  const insert = db.prepare(`
    INSERT INTO calendar_events
      (id, saveId, templateId, circuitLevel, name, label, venueId, venueName, venueCapacity,
       cityId, countryDisplay, nationId, year, week, weightClasses, status, boutIds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  db.transaction(() => {
    for (const e of events) {
      insert.run(
        e.id, saveId, e.templateId, e.circuitLevel, e.name, e.label,
        e.venueId, e.venueName, e.venueCapacity,
        e.cityId, e.countryDisplay ?? null, e.nationId,
        e.year, e.week,
        JSON.stringify(e.weightClasses),
        e.status,
        JSON.stringify(e.boutIds),
      )
    }
  })()
}

// loadCalendar returns all calendar events for a save ordered by year then week.
export function loadCalendar(
  db: Database.Database,
  saveId: string,
): CalendarEvent[] {
  type Row = {
    id: string; templateId: string; circuitLevel: string; name: string; label: string
    venueId: string; venueName: string; venueCapacity: number
    cityId: string; countryDisplay: string | null; nationId: string
    year: number; week: number
    weightClasses: string; status: string; boutIds: string
  }
  const rows = db
    .prepare('SELECT * FROM calendar_events WHERE saveId = ? ORDER BY year, week')
    .all(saveId) as Row[]

  return rows.map(r => {
    const event: CalendarEvent = {
      id: r.id,
      templateId: r.templateId,
      circuitLevel: r.circuitLevel as CalendarEvent['circuitLevel'],
      name: r.name,
      label: r.label,
      venueId: r.venueId,
      venueName: r.venueName,
      venueCapacity: r.venueCapacity,
      cityId: r.cityId,
      nationId: r.nationId,
      year: r.year,
      week: r.week,
      weightClasses: JSON.parse(r.weightClasses) as string[],
      status: r.status as EventStatus,
      boutIds: JSON.parse(r.boutIds) as string[],
    }
    if (r.countryDisplay !== null) {
      event.countryDisplay = r.countryDisplay
    }
    return event
  })
}

// getUpcomingEvents returns calendar events within weeksAhead of the current position.
// Used by the Calendar screen to show a forward-looking event list.
export function getUpcomingEvents(
  db: Database.Database,
  saveId: string,
  currentWeek: number,
  currentYear: number,
  weeksAhead: number,
): CalendarEvent[] {
  // Convert week position to a comparable integer (year * 100 + week).
  // This allows a simple numeric comparison across year boundaries without
  // needing date arithmetic — the range [currentPos, currentPos + weeksAhead]
  // is approximate but sufficient for the UI's forward-view window.
  const currentPos = currentYear * 100 + currentWeek
  const endYear = Math.floor((currentPos + weeksAhead) / 100)
  const endWeek = (currentPos + weeksAhead) % 100

  type Row = {
    id: string; templateId: string; circuitLevel: string; name: string; label: string
    venueId: string; venueName: string; venueCapacity: number
    cityId: string; countryDisplay: string | null; nationId: string
    year: number; week: number
    weightClasses: string; status: string; boutIds: string
  }

  const rows = db.prepare(`
    SELECT * FROM calendar_events
    WHERE saveId = ?
      AND ((year = ? AND week >= ?) OR (year > ? AND year < ?) OR (year = ? AND week <= ?))
    ORDER BY year, week
  `).all(saveId, currentYear, currentWeek, currentYear, endYear, endYear, endWeek) as Row[]

  return rows.map(r => {
    const event: CalendarEvent = {
      id: r.id,
      templateId: r.templateId,
      circuitLevel: r.circuitLevel as CalendarEvent['circuitLevel'],
      name: r.name,
      label: r.label,
      venueId: r.venueId,
      venueName: r.venueName,
      venueCapacity: r.venueCapacity,
      cityId: r.cityId,
      nationId: r.nationId,
      year: r.year,
      week: r.week,
      weightClasses: JSON.parse(r.weightClasses) as string[],
      status: r.status as EventStatus,
      boutIds: JSON.parse(r.boutIds) as string[],
    }
    if (r.countryDisplay !== null) {
      event.countryDisplay = r.countryDisplay
    }
    return event
  })
}

// updateEventStatus changes the status of a single calendar event.
// Called by the simulation when an event transitions through its lifecycle.
export function updateEventStatus(
  db: Database.Database,
  saveId: string,
  eventId: string,
  status: EventStatus,
): void {
  db.prepare(
    'UPDATE calendar_events SET status = ? WHERE id = ? AND saveId = ?',
  ).run(status, eventId, saveId)
}

// saveBout persists a single bout. result is serialised as JSON so the flexible
// BoutResult shape can be stored without a separate table.
export function saveBout(db: Database.Database, saveId: string, bout: Bout): void {
  db.prepare(`
    INSERT OR REPLACE INTO bouts
      (id, saveId, eventId, circuitLevel, weightClassId, ageCategoryId,
       fighterAId, fighterBId, gymAId, gymBId, scheduledRounds, status, result)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bout.id, saveId, bout.eventId, bout.circuitLevel, bout.weightClassId,
    bout.ageCategoryId, bout.fighterAId, bout.fighterBId, bout.gymAId, bout.gymBId,
    bout.scheduledRounds, bout.status,
    bout.result !== undefined ? JSON.stringify(bout.result) : null,
  )
}

// getBout retrieves a single bout by id, deserialising result from JSON.
export function getBout(db: Database.Database, saveId: string, boutId: string): Bout | null {
  type Row = {
    id: string; eventId: string; circuitLevel: string; weightClassId: string
    ageCategoryId: string; fighterAId: string; fighterBId: string
    gymAId: string; gymBId: string; scheduledRounds: number
    status: string; result: string | null
  }
  const row = db
    .prepare('SELECT * FROM bouts WHERE id = ? AND saveId = ?')
    .get(boutId, saveId) as Row | undefined

  if (row === undefined) return null

  const bout: Bout = {
    id: row.id,
    eventId: row.eventId,
    circuitLevel: row.circuitLevel,
    weightClassId: row.weightClassId,
    ageCategoryId: row.ageCategoryId,
    fighterAId: row.fighterAId,
    fighterBId: row.fighterBId,
    gymAId: row.gymAId,
    gymBId: row.gymBId,
    scheduledRounds: row.scheduledRounds,
    status: row.status as Bout['status'],
  }
  if (row.result !== null) {
    bout.result = JSON.parse(row.result) as BoutResult
  }
  return bout
}

// saveCard persists a card. boutIds serialised as JSON array.
export function saveCard(db: Database.Database, saveId: string, card: Card): void {
  db.prepare(`
    INSERT OR REPLACE INTO cards (id, saveId, eventId, boutIds, visibility)
    VALUES (?, ?, ?, ?, ?)
  `).run(card.id, saveId, card.eventId, JSON.stringify(card.boutIds), card.visibility)
}

// saveTournamentBracket persists a bracket. entrants and rounds serialised as JSON.
export function saveTournamentBracket(
  db: Database.Database,
  saveId: string,
  bracket: TournamentBracket,
): void {
  db.prepare(`
    INSERT OR REPLACE INTO tournament_brackets
      (id, saveId, eventId, weightClassId, ageCategoryId, entrants, rounds, winnerId, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bracket.id, saveId, bracket.eventId, bracket.weightClassId, bracket.ageCategoryId,
    JSON.stringify(bracket.entrants), JSON.stringify(bracket.rounds),
    bracket.winnerId ?? null, bracket.status,
  )
}

// getTournamentBrackets returns all brackets for a given event, ordered by weightClassId.
export function getTournamentBrackets(
  db: Database.Database,
  saveId: string,
  eventId: string,
): TournamentBracket[] {
  type Row = {
    id: string; eventId: string; weightClassId: string; ageCategoryId: string
    entrants: string; rounds: string; winnerId: string | null; status: string
  }
  const rows = db
    .prepare('SELECT * FROM tournament_brackets WHERE saveId = ? AND eventId = ? ORDER BY weightClassId')
    .all(saveId, eventId) as Row[]

  return rows.map(r => {
    const bracket: TournamentBracket = {
      id: r.id,
      eventId: r.eventId,
      weightClassId: r.weightClassId,
      ageCategoryId: r.ageCategoryId,
      entrants: JSON.parse(r.entrants) as TournamentBracket['entrants'],
      rounds: JSON.parse(r.rounds) as TournamentBracket['rounds'],
      status: r.status as TournamentBracket['status'],
    }
    if (r.winnerId !== null) {
      bracket.winnerId = r.winnerId
    }
    return bracket
  })
}

// saveMultiDayEvent persists the day structure for a multi-day event.
// days is serialised as a JSON array of MultiDaySession objects.
export function saveMultiDayEvent(
  db: Database.Database,
  saveId: string,
  event: MultiDayEvent,
): void {
  db.prepare(`
    INSERT OR REPLACE INTO multi_day_events (eventId, saveId, days)
    VALUES (?, ?, ?)
  `).run(event.eventId, saveId, JSON.stringify(event.days))
}
