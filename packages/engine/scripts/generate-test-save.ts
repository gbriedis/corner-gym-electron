// generate-test-save.ts — Creates a test SQLite save file for CLI inspection.
// Runs generateWorld + runBackrun and writes results to a .db file.
// No Electron dependency — uses node:sqlite directly.
//
// Run: tsx scripts/generate-test-save.ts [output.db] [--nations latvia,usa]
//
// Default output: test.db in the engine directory.

import { randomUUID } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

type SqliteModule = {
  DatabaseSync: new (path: string, options?: { readonly?: boolean }) => {
    prepare(sql: string): {
      all(...params: unknown[]): unknown[]
      get(...params: unknown[]): unknown
      run(...params: unknown[]): void
    }
    exec(sql: string): void
    close(): void
    transaction(fn: () => void): () => void
  }
}

const sqlitePath: string = 'node:sqlite'
const { DatabaseSync } = (await import(sqlitePath)) as SqliteModule

const __dirname = dirname(fileURLToPath(import.meta.url))

// Parse args
const args = process.argv.slice(2).filter(a => a !== '--')
let outputPath = 'test.db'
let nations = ['latvia']

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--nations' && args[i + 1]) {
    nations = args[i + 1]!.split(',')
    i++
  } else if (!args[i]!.startsWith('--')) {
    outputPath = args[i]!
  }
}

const resolvedPath = resolve(outputPath)
console.log(`Generating save → ${resolvedPath}`)
console.log(`Nations: ${nations.join(', ')}`)

// Import engine — tsx resolves TypeScript directly
import { loadGameData, generateWorld, runBackrun } from '../src/index.js'
import type { YearEndBatch } from '../src/generation/backrun.js'

const data = loadGameData()

const config = {
  seed: 42,
  startYear: 2026,
  playerName: 'Test Player',
  gymName: 'Test Gym',
  playerCityId: 'latvia-riga',
  playerNationId: 'latvia',
  renderedNations: nations,
  includedNations: nations,
  difficulty: 'normal',
  difficultyModifiers: {},
  leagues: { amateur: true, pro: false },
  worldSettings: {
    populationPerCity: { small_town: 200, mid_city: 400, capital: 800 },
    gymsPerCity: { small_town: 2, mid_city: 4, capital: 6 },
  },
}

console.log('Generating world...')
const { worldState, persons, fighters, gyms, coaches, calendar } = generateWorld(config, data)
console.log(`  ${fighters.length} fighters, ${gyms.length} gyms, ${calendar.length} events`)

// ─── Create database ──────────────────────────────────────────────────────────

const db = new DatabaseSync(resolvedPath)
db.exec(`PRAGMA journal_mode = WAL`)
db.exec(`PRAGMA foreign_keys = ON`)

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
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS persons (
    id TEXT NOT NULL,
    saveId TEXT NOT NULL,
    data TEXT NOT NULL,
    cityId TEXT NOT NULL,
    gymId TEXT,
    nationId TEXT NOT NULL,
    age INTEGER NOT NULL,
    PRIMARY KEY (id, saveId)
  );
  CREATE TABLE IF NOT EXISTS gyms (
    id TEXT NOT NULL,
    saveId TEXT NOT NULL,
    data TEXT NOT NULL,
    cityId TEXT NOT NULL,
    nationId TEXT NOT NULL,
    isPlayerGym INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, saveId)
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
    PRIMARY KEY (id, saveId)
  );
  CREATE TABLE IF NOT EXISTS coaches (
    id TEXT NOT NULL,
    saveId TEXT NOT NULL,
    data TEXT NOT NULL,
    gymId TEXT NOT NULL,
    personId TEXT NOT NULL,
    quality INTEGER NOT NULL,
    PRIMARY KEY (id, saveId)
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
    PRIMARY KEY (id, saveId)
  );
`)

const saveId = randomUUID()
const now = new Date().toISOString()

// Build gymId lookup from fighterIds — persons array is empty, all entities are Fighters.
const gymMemberLookup = new Map<string, string>()
for (const gym of gyms) {
  for (const fighterId of gym.fighterIds) {
    gymMemberLookup.set(fighterId, gym.id)
  }
}

// Write initial save and world state
db.prepare(`
  INSERT INTO saves (id, saveName, playerName, gymName, cityId, nationId,
    currentYear, currentWeek, seed, difficulty, createdAt, lastPlayedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(saveId, 'Test Player — Test Gym', 'Test Player', 'Test Gym',
  'latvia-riga', 'latvia', config.startYear, 1, config.seed, 'normal', now, now)

const stateWithSaveId = { ...worldState, saveId }
db.prepare(`INSERT INTO world_state (saveId, data) VALUES (?, ?)`).run(
  saveId, JSON.stringify(stateWithSaveId))

const insertPerson = db.prepare(`
  INSERT INTO persons (id, saveId, data, cityId, gymId, nationId, age)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)
// Write fighters to persons table — all entities are Fighters, persons array is always empty.
db.exec('BEGIN')
for (const fighter of fighters) {
  const gymId = gymMemberLookup.get(fighter.id) ?? null
  insertPerson.run(fighter.id, saveId, JSON.stringify(fighter),
    fighter.cityId, gymId, fighter.nationId, fighter.age)
}
db.exec('COMMIT')

const insertGym = db.prepare(`
  INSERT INTO gyms (id, saveId, data, cityId, nationId, isPlayerGym)
  VALUES (?, ?, ?, ?, ?, ?)
`)
db.exec('BEGIN')
for (const gym of gyms) {
  insertGym.run(gym.id, saveId, JSON.stringify(gym),
    gym.cityId, gym.nationId, gym.isPlayerGym ? 1 : 0)
}
db.exec('COMMIT')

const insertCoach = db.prepare(`
  INSERT INTO coaches (id, saveId, data, gymId, personId, quality)
  VALUES (?, ?, ?, ?, ?, ?)
`)
db.exec('BEGIN')
for (const coach of coaches) {
  insertCoach.run(coach.id, saveId, JSON.stringify(coach),
    coach.gymId, coach.personId, coach.quality)
}
db.exec('COMMIT')

const insertEvent = db.prepare(`
  INSERT INTO calendar_events
    (id, saveId, templateId, circuitLevel, name, label, venueId, venueName, venueCapacity,
     cityId, countryDisplay, nationId, year, week, weightClasses, status, boutIds)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
db.exec('BEGIN')
for (const e of calendar) {
  insertEvent.run(e.id, saveId, e.templateId, e.circuitLevel, e.name, e.label,
    e.venueId, e.venueName ?? '', e.venueCapacity ?? 0,
    e.cityId, e.countryDisplay ?? null, e.nationId,
    e.year, e.week,
    JSON.stringify(e.weightClasses ?? []),
    e.status, JSON.stringify(e.boutIds ?? []))
}
db.exec('COMMIT')

// ─── Run backrun ──────────────────────────────────────────────────────────────

const insertBout = db.prepare(`
  INSERT OR REPLACE INTO bouts
    (id, saveId, eventId, circuitLevel, weightClassId, ageCategoryId,
     fighterAId, fighterBId, gymAId, gymBId, scheduledRounds, status, result)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertFighterStmt = db.prepare(`
  INSERT INTO persons (id, saveId, data, cityId, gymId, nationId, age)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const updateFighterStmt = db.prepare(`
  UPDATE persons SET data = ?, age = ? WHERE id = ? AND saveId = ?
`)

const updateGymStmt = db.prepare(`
  UPDATE gyms SET data = ? WHERE id = ? AND saveId = ?
`)

function writeBatch(batch: YearEndBatch): void {
  db.exec('BEGIN')
  for (const result of batch.pendingBoutResults) {
    insertBout.run(
      result.boutId, saveId, 'backrun', 'club_card',
      'unknown', 'senior',
      result.winnerId ?? 'draw', result.loserId ?? 'draw',
      '', '',
      result.scheduledRounds, 'completed',
      JSON.stringify(result),
    )
  }
  for (const fighterId of batch.pendingNewFighterIds) {
    const fighter = batch.fighters.get(fighterId)
    if (fighter !== undefined) {
      const gymId = gymMemberLookup.get(fighter.id) ?? null
      insertFighterStmt.run(fighter.id, saveId, JSON.stringify(fighter),
        fighter.cityId, gymId, fighter.nationId, fighter.age)
    }
  }
  for (const fighterId of batch.pendingFighterUpdates) {
    // Skip new fighters already inserted above
    if (batch.pendingNewFighterIds.has(fighterId)) continue
    const fighter = batch.fighters.get(fighterId)
    if (fighter !== undefined) {
      updateFighterStmt.run(JSON.stringify(fighter), fighter.age, fighter.id, saveId)
    }
  }
  for (const gymId of batch.pendingGymUpdates) {
    const gym = batch.gyms.get(gymId)
    if (gym !== undefined) {
      updateGymStmt.run(JSON.stringify(gym), gym.id, saveId)
    }
  }
  db.exec('COMMIT')
}

console.log('Running 10-year backrun...')
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
  writeBatch,
  (progress) => {
    process.stdout.write(`\r  Year ${progress.year} · ${progress.boutsSimulated} bouts`)
  },
)
console.log('\nBackrun complete.')
db.close()
console.log(`\nSave written to: ${resolvedPath}`)
console.log(`Run: pnpm inspect -- ${resolvedPath}`)
