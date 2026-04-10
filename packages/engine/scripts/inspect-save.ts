// inspect-save.ts — CLI tool that reads a Corner Gym SQLite save file and
// prints a simulation health report to the terminal.
//
// Run: tsx scripts/inspect-save.ts <path-to-save.db>
//
// Uses node:sqlite (built-in Node 22+) so no native module compilation is needed.
// Read-only. No Electron. No IPC.
// Uses the most recent save in the file if multiple saves exist.

import { readFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// node:sqlite is built in to Node 22.5+ but @types/node v20 doesn't include it.
// Cast the module import to avoid the missing-module error in older @types/node.
type SqliteModule = {
  DatabaseSync: new (path: string, options?: { readonly?: boolean }) => {
    prepare(sql: string): {
      all(...params: unknown[]): unknown[]
      get(...params: unknown[]): unknown
    }
    close(): void
  }
}

// Using a variable import path suppresses the TypeScript module-not-found error
// while still resolving correctly at runtime in Node 22.5+.
const sqlitePath: string = 'node:sqlite'
const { DatabaseSync } = (await import(sqlitePath)) as SqliteModule

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Args ─────────────────────────────────────────────────────────────────────

// Skip the '--' separator that pnpm injects when using: pnpm inspect -- <path>
const savePath = process.argv[2] === '--' ? process.argv[3] : process.argv[2]
if (savePath === undefined || savePath === '') {
  console.error('Usage: tsx scripts/inspect-save.ts <path-to-save.db>')
  process.exit(1)
}

const db = new DatabaseSync(resolve(savePath), { readonly: true })

// ─── Types ────────────────────────────────────────────────────────────────────

interface SaveRow {
  id: string
  playerName: string
  gymName: string
  nationId: string
  currentYear: number
  currentWeek: number
  seed: number
  createdAt: string
}

interface FighterBlob {
  id: string
  name: { first: string; surname: string }
  age: number
  nationId: string
  cityId: string
  fighterIdentity: { state: string }
  developedAttributes: Array<{ attributeId: string; current: number }>
  competition: {
    weightClassId: string
    amateur: { wins: number; losses: number }
    pro: { wins: number; losses: number }
  }
  career: { currentGymId: string | null }
}

interface GymBlob {
  id: string
  name: string
  nationId: string
  finances: { balance: number }
}

interface BoutRow {
  circuitLevel: string
  scheduledRounds: number
  result: string | null
}

interface BoutResult {
  method: string
  endRound: number
  scheduledRounds: number
}

interface NationJson {
  id: string
  proEcosystemStartLevel?: number
}

interface ProEcosystemJson {
  nationId: string
  thresholds: Array<{ level: number; label: string }>
}

// ─── Output Helpers ───────────────────────────────────────────────────────────

function bar(value: number, max: number, width: number = 20): string {
  const filled = Math.round((value / max) * width)
  const clamped = Math.max(0, Math.min(filled, width))
  return '█'.repeat(clamped) + '░'.repeat(width - clamped)
}

function pct(value: number, total: number): string {
  if (total === 0) return '0.0%'
  return ((value / total) * 100).toFixed(1) + '%'
}

function commas(n: number): string {
  return n.toLocaleString('en-US')
}

function calcMean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function calcMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0)
}

function calcStddev(values: number[]): number {
  if (values.length === 0) return 0
  const m = calcMean(values)
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function r1(n: number): number {
  return Math.round(n * 10) / 10
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isFighter(data: unknown): data is FighterBlob {
  return (
    typeof data === 'object' &&
    data !== null &&
    'fighterIdentity' in data &&
    'developedAttributes' in data &&
    'competition' in data
  )
}

function loadNationJson(nationId: string): NationJson | null {
  const dataDir = join(__dirname, '..', 'data', 'nations', nationId)
  try {
    return JSON.parse(readFileSync(join(dataDir, 'nation.json'), 'utf-8')) as NationJson
  } catch {
    return null
  }
}

function loadProEcosystemJson(nationId: string): ProEcosystemJson | null {
  const dataDir = join(__dirname, '..', 'data', 'nations', nationId)
  try {
    return JSON.parse(
      readFileSync(join(dataDir, 'boxing', 'pro-ecosystem.json'), 'utf-8'),
    ) as ProEcosystemJson
  } catch {
    return null
  }
}

// ─── Typed query wrappers ─────────────────────────────────────────────────────

function queryAll<T>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...params) as T[]
}

function queryOne<T>(sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}

// ─── Resolve save ─────────────────────────────────────────────────────────────

// Use the most recent save by lastPlayedAt if multiple saves exist.
const save = queryOne<SaveRow>(
  'SELECT id, playerName, gymName, nationId, currentYear, currentWeek, seed, createdAt FROM saves ORDER BY lastPlayedAt DESC LIMIT 1',
)

if (save === undefined) {
  console.error('No saves found in this database.')
  process.exit(1)
}

const saveId = save.id

// ─── Load fighters ────────────────────────────────────────────────────────────

const personRows = queryAll<{ data: string }>('SELECT data FROM persons WHERE saveId = ?', saveId)

const allFighters: FighterBlob[] = []
for (const row of personRows) {
  const parsed = JSON.parse(row.data) as unknown
  if (isFighter(parsed)) allFighters.push(parsed)
}

// ─── World state ──────────────────────────────────────────────────────────────

type WorldBlob = {
  seed: number
  currentYear: number
  nations: Record<string, unknown>
}

const worldRow = queryOne<{ data: string }>('SELECT data FROM world_state WHERE saveId = ?', saveId)

const worldState: WorldBlob = worldRow !== undefined
  ? (JSON.parse(worldRow.data) as WorldBlob)
  : { seed: save.seed, currentYear: save.currentYear, nations: {} }

const nations = Object.keys(worldState.nations)

// ─── Nation counts ────────────────────────────────────────────────────────────

const personCountByNation = new Map<string, number>()
for (const r of queryAll<{ nationId: string; count: number }>(
  'SELECT nationId, COUNT(*) as count FROM persons WHERE saveId = ? GROUP BY nationId', saveId,
)) {
  personCountByNation.set(r.nationId, Number(r.count))
}

const gymCountByNation = new Map<string, number>()
for (const r of queryAll<{ nationId: string; count: number }>(
  'SELECT nationId, COUNT(*) as count FROM gyms WHERE saveId = ? GROUP BY nationId', saveId,
)) {
  gymCountByNation.set(r.nationId, Number(r.count))
}

const cityCountByNation = new Map<string, number>()
for (const r of queryAll<{ nationId: string; count: number }>(
  'SELECT nationId, COUNT(DISTINCT cityId) as count FROM persons WHERE saveId = ? GROUP BY nationId', saveId,
)) {
  cityCountByNation.set(r.nationId, Number(r.count))
}

// ─── Bouts ────────────────────────────────────────────────────────────────────

const boutRows = queryAll<BoutRow>(
  `SELECT circuitLevel, scheduledRounds, result FROM bouts WHERE saveId = ? AND status = 'completed'`,
  saveId,
)

// ─── Print report ─────────────────────────────────────────────────────────────

const SEP = '═'.repeat(55)
const THIN = '─'.repeat(53)

console.log(SEP)
console.log('  CORNER GYM — SAVE INSPECTION REPORT')
console.log(`  Save: ${savePath}`)
console.log(`  Generated: ${new Date().toISOString().slice(0, 10)}`)
console.log(SEP)

// ─── WORLD SUMMARY ────────────────────────────────────────────────────────────

// Derive backrun period from game year — backrun always covers 10 years.
const endYear = save.currentYear
const startYear = endYear - 10
const weeksBackrun = 520

console.log('\nWORLD SUMMARY')
console.log(THIN)
console.log(`Nations included: ${nations.join(', ')}`)
console.log(`Backrun period: ${startYear} → ${endYear} (${weeksBackrun} weeks)`)

for (const nationId of nations) {
  const nf = allFighters.filter(f => f.nationId === nationId)
  const competing = nf.filter(f => f.fighterIdentity.state === 'competing').length
  const aspiring = nf.filter(f => f.fighterIdentity.state === 'aspiring').length
  const retired = nf.filter(f => f.fighterIdentity.state === 'retired').length
  const unaware = nf.filter(f => f.fighterIdentity.state === 'unaware').length

  // Bout count: sum wins+losses for all fighters then halve
  // (each bout is counted once per fighter, so twice total).
  const boutTotal = nf.reduce(
    (sum, f) => sum + f.competition.amateur.wins + f.competition.amateur.losses
      + f.competition.pro.wins + f.competition.pro.losses,
    0,
  )
  const boutsResolved = Math.round(boutTotal / 2)

  console.log(`\n  ${nationId}`)
  console.log(`  ├─ Cities: ${cityCountByNation.get(nationId) ?? 0}`)
  console.log(`  ├─ Gyms: ${gymCountByNation.get(nationId) ?? 0}`)
  console.log(`  ├─ Persons: ${commas(personCountByNation.get(nationId) ?? 0)}`)
  console.log(`  ├─ Fighters: ${commas(nf.length)}`)
  console.log(`  │    competing: ${competing}  aspiring: ${aspiring}  retired: ${retired}  unaware: ${unaware}`)
  console.log(`  └─ Bouts resolved: ${commas(boutsResolved)}`)
}

// ─── BOUT RESULTS HEALTH CHECK ────────────────────────────────────────────────

console.log('\n' + THIN)
console.log('BOUT RESULTS HEALTH CHECK')
console.log(THIN)

const parsedBouts: Array<{ circuitLevel: string; result: BoutResult }> = []
for (const row of boutRows) {
  if (row.result === null) continue
  const r = JSON.parse(row.result) as BoutResult
  parsedBouts.push({ circuitLevel: row.circuitLevel, result: r })
}

const total = parsedBouts.length
console.log(`Total bouts: ${commas(total)}`)

if (total > 0) {
  const koTko = parsedBouts.filter(b => b.result.method === 'ko' || b.result.method === 'tko').length
  const decisions = parsedBouts.filter(
    b => b.result.method === 'decision' || b.result.method === 'split_decision' || b.result.method === 'majority_decision',
  ).length
  const splitMaj = parsedBouts.filter(
    b => b.result.method === 'split_decision' || b.result.method === 'majority_decision',
  ).length
  const noContest = parsedBouts.filter(b => b.result.method === 'no_contest').length

  const koTkoPct = (koTko / total) * 100
  const decPct = (decisions / total) * 100

  console.log('\n  By method:')
  console.log(`  KO/TKO        ${pct(koTko, total).padStart(6)}  ${bar(koTkoPct, 100)}`)
  console.log(`  Decision      ${pct(decisions, total).padStart(6)}  ${bar(decPct, 100)}`)
  if (decisions > 0) {
    console.log(`  Split/Maj     ${pct(splitMaj, decisions).padStart(6)}  of all decisions`)
  }
  console.log(`  No Contest    ${pct(noContest, total).padStart(6)}`)

  // Per-circuit avg end round vs scheduled rounds
  const circuitIds = [...new Set(parsedBouts.map(b => b.circuitLevel))].sort()
  if (circuitIds.length > 0) {
    console.log('\n  By circuit:')
    for (const circuit of circuitIds) {
      const cb = parsedBouts.filter(b => b.circuitLevel === circuit)
      if (cb.length === 0) continue
      const avgEnd = r1(calcMean(cb.map(b => b.result.endRound)))
      const avgSched = r1(calcMean(cb.map(b => b.result.scheduledRounds)))
      const label = circuit.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      console.log(`  ${label.padEnd(16)} avg end round ${avgEnd} / ${avgSched} scheduled`)
    }
  }

  const stoppagePct = ((koTko / total) * 100).toFixed(1)
  console.log(`\n  [TARGET: ~30-35% stoppages for amateur level — actual: ${stoppagePct}%]`)
}

// ─── ATTRIBUTE DISTRIBUTIONS ──────────────────────────────────────────────────

// Six representative attributes — physical ceiling, mental, and stamina pillars.
const KEY_ATTRIBUTES = ['power', 'chin', 'ring_iq', 'heart', 'composure', 'stamina']

for (const nationId of nations) {
  // Filter to competing fighters only — their attributes are what the bout simulation
  // is calibrated against. Aspiring/unaware/retired would skew the distribution.
  const nf = allFighters.filter(
    f => f.nationId === nationId && f.fighterIdentity.state === 'competing',
  )
  if (nf.length === 0) continue

  console.log('\n' + THIN)
  console.log(`ATTRIBUTE DISTRIBUTIONS (${nationId} — competing fighters only, n=${nf.length})`)
  console.log(THIN)

  for (const attrId of KEY_ATTRIBUTES) {
    const values = nf
      .map(f => f.developedAttributes.find(a => a.attributeId === attrId)?.current ?? null)
      .filter((v): v is number => v !== null)

    if (values.length === 0) continue

    const sorted = [...values].sort((a, b) => a - b)
    const m = r1(calcMean(values))
    const med = r1(calcMedian(values))
    const mn = r1(sorted[0] ?? 0)
    const mx = r1(sorted[sorted.length - 1] ?? 0)
    const sd = r1(calcStddev(values))

    const label = attrId.padEnd(12)
    console.log(`  ${label} mean: ${String(m).padStart(4)}  median: ${String(med).padStart(4)}  min: ${mn}  max: ${mx}  stddev: ${sd}`)
  }

  console.log('\n  [TARGET: power 7-11, ring_iq 4-8, heart 3-6 for competing fighters]')
}

// ─── GYM FINANCIALS ───────────────────────────────────────────────────────────

for (const nationId of nations) {
  const gymRows2 = queryAll<{ data: string }>(
    'SELECT data FROM gyms WHERE saveId = ? AND nationId = ?', saveId, nationId,
  )

  if (gymRows2.length === 0) continue

  const gyms: GymBlob[] = gymRows2.map(r => JSON.parse(r.data) as GymBlob)

  const deficit = gyms.filter(g => g.finances.balance < 0).length
  const struggling = gyms.filter(g => g.finances.balance >= 0 && g.finances.balance < 500).length
  const healthy = gyms.filter(g => g.finances.balance > 2000).length
  const gymTotal = gyms.length

  const sorted = [...gyms].sort((a, b) => b.finances.balance - a.finances.balance)
  const richest = sorted[0]
  const poorest = sorted[sorted.length - 1]

  console.log('\n' + THIN)
  console.log(`GYM FINANCIALS HEALTH CHECK (${nationId})`)
  console.log(THIN)
  console.log(`  Gyms in deficit (balance < 0):     ${deficit} / ${gymTotal}  (${pct(deficit, gymTotal)})`)
  console.log(`  Gyms struggling (balance < €500):  ${deficit + struggling} / ${gymTotal}  (${pct(deficit + struggling, gymTotal)})`)
  console.log(`  Gyms healthy (balance > €2000):    ${healthy} / ${gymTotal}  (${pct(healthy, gymTotal)})`)

  if (richest !== undefined) {
    console.log(`\n  Most profitable:  ${richest.name.padEnd(24)} €${commas(Math.round(richest.finances.balance))}`)
  }
  if (poorest !== undefined && poorest !== richest) {
    const bal = Math.round(poorest.finances.balance)
    const sign = bal < 0 ? '-' : ''
    console.log(`  Most struggling:  ${poorest.name.padEnd(24)} €${sign}${commas(Math.abs(bal))}`)
  }
}

// ─── PRO ECOSYSTEM ────────────────────────────────────────────────────────────

console.log('\n' + THIN)
console.log('PRO ECOSYSTEM')
console.log(THIN)

for (const nationId of nations) {
  const nationJson = loadNationJson(nationId)
  const ecosystemJson = loadProEcosystemJson(nationId)

  // proEcosystemStartLevel defaults to 0 (no existing pro scene at game start).
  const level = nationJson?.proEcosystemStartLevel ?? 0
  // Level 0 is the pre-scene baseline — no threshold label exists for it.
  const label = level === 0
    ? 'No Scene'
    : (ecosystemJson?.thresholds.find(t => t.level === level)?.label ?? `Level ${level}`)

  console.log(`  ${nationId.padEnd(10)} Level ${level} — ${label}`)
}

// ─── TOP FIGHTERS ─────────────────────────────────────────────────────────────

for (const nationId of nations) {
  const competing = allFighters.filter(
    f => f.nationId === nationId && f.fighterIdentity.state === 'competing',
  )

  if (competing.length === 0) continue

  // Sort by win total desc, then losses asc as tiebreak.
  const ranked = [...competing].sort((a, b) => {
    const aWins = a.competition.amateur.wins + a.competition.pro.wins
    const bWins = b.competition.amateur.wins + b.competition.pro.wins
    if (bWins !== aWins) return bWins - aWins
    const aLoss = a.competition.amateur.losses + a.competition.pro.losses
    const bLoss = b.competition.amateur.losses + b.competition.pro.losses
    return aLoss - bLoss
  })

  const top10 = ranked.slice(0, 10)
  const gymNameCache = new Map<string, string>()

  console.log('\n' + THIN)
  console.log(`TOP FIGHTERS BY RECORD (${nationId}, competing)`)
  console.log(THIN)

  for (let i = 0; i < top10.length; i++) {
    const f = top10[i]
    if (f === undefined) continue

    const wins = f.competition.amateur.wins + f.competition.pro.wins
    const losses = f.competition.amateur.losses + f.competition.pro.losses
    const record = `${wins}-${losses}`

    // Gym city label (cached to avoid N+1 queries).
    let gymLabel = f.cityId
    if (f.career.currentGymId !== null) {
      if (!gymNameCache.has(f.career.currentGymId)) {
        const gr = queryOne<{ data: string }>(
          'SELECT data FROM gyms WHERE id = ? AND saveId = ?',
          f.career.currentGymId,
          saveId,
        )
        if (gr !== undefined) {
          const g = JSON.parse(gr.data) as { name: string }
          gymNameCache.set(f.career.currentGymId, g.name)
        }
      }
      gymLabel = gymNameCache.get(f.career.currentGymId) ?? f.cityId
    }

    const rank = String(i + 1).padStart(2)
    const name = `${f.name.first} ${f.name.surname}`.padEnd(24)
    const loc = gymLabel.slice(0, 16).padEnd(16)
    const rec = record.padEnd(8)
    const wc = f.competition.weightClassId
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
    console.log(`  ${rank}.  ${name} ${loc} ${rec} ${wc}   age ${f.age}`)
  }
}

console.log('\n' + SEP)

db.close()
