// db-dev.ts provides read-only queries for the developer dashboard.
// No new tables required — reads the existing schema and aggregates in-memory.
// Fighter data is stored as JSON blobs; we deserialise and filter here.
// This is a diagnostic tool — query performance is secondary to correctness.

import type Database from 'better-sqlite3'
import type { Fighter } from '@corner-gym/engine'
import type { Gym } from '@corner-gym/engine'
import type { BoutResolutionResult } from '@corner-gym/engine'

// ─── Exported Types ───────────────────────────────────────────────────────────

export interface NationDevSummary {
  nationId: string
  personCount: number
  gymCount: number
  fighterCount: number
  competingCount: number
  aspiringCount: number
  curiousCount: number
  unawareCount: number
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

// ─── Private Helpers ──────────────────────────────────────────────────────────

// isFighter checks whether a deserialised blob has the Fighter-specific fields.
// Persons who were never touched by the backrun are stored as plain Person objects.
// After the backrun, fighters that were active have their full Fighter data persisted.
function isFighter(data: unknown): data is Fighter {
  return (
    typeof data === 'object' &&
    data !== null &&
    'fighterIdentity' in data &&
    'developedAttributes' in data &&
    'competition' in data
  )
}

// parseYearWeekFromBoutId extracts year and week from the encoded event ID inside a boutId.
// BoutId format: backrun_${templateId}--${cityId}--${year}w${week}_${fighterAId}_${fighterBId}
// The --${year}w${week} pattern is unique enough for a targeted regex match.
function parseYearWeekFromBoutId(boutId: string): { year: number; week: number } {
  const match = boutId.match(/--(\d{4})w(\d{2})/)
  if (match === null) return { year: 0, week: 0 }
  return { year: parseInt(match[1], 10), week: parseInt(match[2], 10) }
}

// loadAllFighters deserialises every person blob for a save and returns only Fighters.
// Called by world summary and attribute distribution — both need the full fighter set.
function loadAllFighters(db: Database.Database, saveId: string): Fighter[] {
  const rows = db
    .prepare('SELECT data FROM persons WHERE saveId = ?')
    .all(saveId) as Array<{ data: string }>

  const fighters: Fighter[] = []
  for (const row of rows) {
    const parsed = JSON.parse(row.data) as unknown
    if (isFighter(parsed)) {
      fighters.push(parsed)
    }
  }
  return fighters
}

// formatInitial produces "J. Smith" from a full name.
function formatInitial(first: string, surname: string): string {
  return `${first.charAt(0)}. ${surname}`
}

// ─── Query Functions ──────────────────────────────────────────────────────────

export function getDevWorldSummary(
  db: Database.Database,
  saveId: string,
): WorldDevSummary | null {
  const worldRow = db
    .prepare('SELECT data FROM world_state WHERE saveId = ?')
    .get(saveId) as { data: string } | undefined

  if (worldRow === undefined) return null

  type WorldBlob = { seed: number; currentYear: number; nations: Record<string, unknown> }
  const worldState = JSON.parse(worldRow.data) as WorldBlob

  const renderedNations = Object.keys(worldState.nations)

  // Gym counts per nation — SQL column available, no deserialisation needed.
  const gymRows = db
    .prepare('SELECT nationId, COUNT(*) as count FROM gyms WHERE saveId = ? GROUP BY nationId')
    .all(saveId) as Array<{ nationId: string; count: number }>
  const gymCounts = new Map(gymRows.map(r => [r.nationId, Number(r.count)]))

  // Person counts per nation — SQL column available.
  const personRows = db
    .prepare('SELECT nationId, COUNT(*) as count FROM persons WHERE saveId = ? GROUP BY nationId')
    .all(saveId) as Array<{ nationId: string; count: number }>
  const personCounts = new Map(personRows.map(r => [r.nationId, Number(r.count)]))

  // Fighters require deserialisation — done once and shared.
  const allFighters = loadAllFighters(db, saveId)

  // Bout count from bouts table — total resolved bouts for the save.
  const boutTotals = new Map<string, number>()
  for (const f of allFighters) {
    const n = f.nationId
    const bouts = f.competition.amateur.wins + f.competition.amateur.losses + f.competition.pro.wins + f.competition.pro.losses
    boutTotals.set(n, (boutTotals.get(n) ?? 0) + bouts)
  }

  const nationSummaries: NationDevSummary[] = renderedNations.map(nationId => {
    const nf = allFighters.filter(f => f.nationId === nationId)
    // boutTotals sums wins+losses per fighter — each bout appears in both fighters' records,
    // so divide by 2 to get actual bout count.
    const rawBoutTotal = boutTotals.get(nationId) ?? 0
    return {
      nationId,
      personCount: personCounts.get(nationId) ?? 0,
      gymCount: gymCounts.get(nationId) ?? 0,
      fighterCount: nf.length,
      competingCount: nf.filter(f => f.fighterIdentity.state === 'competing').length,
      aspiringCount: nf.filter(f => f.fighterIdentity.state === 'aspiring').length,
      curiousCount: nf.filter(f => f.fighterIdentity.state === 'curious').length,
      unawareCount: nf.filter(f => f.fighterIdentity.state === 'unaware').length,
      retiredCount: nf.filter(f => f.fighterIdentity.state === 'retired').length,
      boutCount: Math.round(rawBoutTotal / 2),
    }
  })

  // Weight class distribution across all fighters — for the horizontal bar chart.
  const wcMap = new Map<string, number>()
  for (const f of allFighters) {
    const wc = f.competition.weightClassId
    wcMap.set(wc, (wcMap.get(wc) ?? 0) + 1)
  }
  const weightClassDistribution = Array.from(wcMap.entries())
    .map(([weightClassId, count]) => ({ weightClassId, count }))
    .sort((a, b) => b.count - a.count)

  return {
    seed: worldState.seed,
    currentYear: worldState.currentYear,
    renderedNations,
    nationSummaries,
    weightClassDistribution,
  }
}

export function getDevFighterList(
  db: Database.Database,
  saveId: string,
  filters: DevFighterFilters,
): { fighters: FighterListItem[]; total: number } {
  // Build query with available SQL columns, then filter the rest in-memory.
  let sql = 'SELECT data FROM persons WHERE saveId = ?'
  const params: unknown[] = [saveId]

  if (filters.nationId !== undefined && filters.nationId !== '') {
    sql += ' AND nationId = ?'
    params.push(filters.nationId)
  }
  if (filters.cityId !== undefined && filters.cityId !== '') {
    sql += ' AND cityId = ?'
    params.push(filters.cityId)
  }

  const rows = db.prepare(sql).all(...params) as Array<{ data: string }>

  const items: FighterListItem[] = []
  for (const row of rows) {
    const parsed = JSON.parse(row.data) as unknown
    if (!isFighter(parsed)) continue

    if (
      filters.identityState !== undefined &&
      filters.identityState !== '' &&
      parsed.fighterIdentity.state !== filters.identityState
    ) continue

    if (
      filters.weightClassId !== undefined &&
      filters.weightClassId !== '' &&
      parsed.competition.weightClassId !== filters.weightClassId
    ) continue

    items.push({
      id: parsed.id,
      firstName: parsed.name.first,
      surname: parsed.name.surname,
      cityId: parsed.cityId,
      nationId: parsed.nationId,
      identityState: parsed.fighterIdentity.state,
      weightClassId: parsed.competition.weightClassId,
      wins: parsed.competition.amateur.wins + parsed.competition.pro.wins,
      losses: parsed.competition.amateur.losses + parsed.competition.pro.losses,
      kos: parsed.competition.pro.knockouts,
      age: parsed.age,
      readiness: parsed.career.readiness,
    })
  }

  // Sort
  const sortBy = filters.sortBy ?? 'wins'
  items.sort((a, b) => {
    switch (sortBy) {
      case 'wins': return b.wins - a.wins
      case 'readiness': return b.readiness - a.readiness
      case 'age': return a.age - b.age
      case 'attributeTotal': return b.wins - a.wins // fallback — total not in list item
      default: return b.wins - a.wins
    }
  })

  return { fighters: items, total: items.length }
}

export function getDevFighterDetail(
  db: Database.Database,
  saveId: string,
  fighterId: string,
): FighterDevDetail | null {
  const row = db
    .prepare('SELECT data FROM persons WHERE id = ? AND saveId = ?')
    .get(fighterId, saveId) as { data: string } | undefined

  if (row === undefined) return null

  const parsed = JSON.parse(row.data) as unknown
  if (!isFighter(parsed)) return null

  // Resolve gym name if assigned.
  let gymName: string | null = null
  if (parsed.career.currentGymId !== null) {
    const gymRow = db
      .prepare('SELECT data FROM gyms WHERE id = ? AND saveId = ?')
      .get(parsed.career.currentGymId, saveId) as { data: string } | undefined
    if (gymRow !== undefined) {
      const gym = JSON.parse(gymRow.data) as { name: string }
      gymName = gym.name
    }
  }

  // Resolve coach quality if assigned.
  let coachQuality: number | null = null
  if (parsed.career.coachId !== null) {
    const coachRow = db
      .prepare('SELECT quality FROM coaches WHERE id = ? AND saveId = ?')
      .get(parsed.career.coachId, saveId) as { quality: number } | undefined
    if (coachRow !== undefined) {
      coachQuality = coachRow.quality
    }
  }

  // Last 5 bouts — stored with winnerId/loserId in fighterAId/fighterBId columns.
  const boutRows = db
    .prepare(`
      SELECT id, result FROM bouts
      WHERE saveId = ? AND (fighterAId = ? OR fighterBId = ?) AND status = 'completed'
      ORDER BY rowid DESC
      LIMIT 5
    `)
    .all(saveId, fighterId, fighterId) as Array<{ id: string; result: string | null }>

  const lastBouts: DevBoutRecord[] = []
  for (const boutRow of boutRows) {
    if (boutRow.result === null) continue
    const result = JSON.parse(boutRow.result) as BoutResolutionResult

    const opponentId = result.winnerId === fighterId ? result.loserId : result.winnerId
    let opponentName = 'Unknown'

    if (opponentId !== null && opponentId !== 'draw') {
      const oppRow = db
        .prepare('SELECT data FROM persons WHERE id = ? AND saveId = ?')
        .get(opponentId, saveId) as { data: string } | undefined
      if (oppRow !== undefined) {
        const opp = JSON.parse(oppRow.data) as { name: { first: string; surname: string } }
        opponentName = formatInitial(opp.name.first, opp.name.surname)
      }
    }

    const { year, week } = parseYearWeekFromBoutId(boutRow.id)
    const boutResult: 'W' | 'L' | 'D' =
      result.winnerId === fighterId ? 'W' :
      result.loserId === fighterId ? 'L' :
      'D'

    lastBouts.push({ year, week, opponentName, result: boutResult, method: result.method, endRound: result.endRound })
  }

  return {
    id: parsed.id,
    firstName: parsed.name.first,
    surname: parsed.name.surname,
    age: parsed.age,
    nationId: parsed.nationId,
    cityId: parsed.cityId,
    gymId: parsed.career.currentGymId,
    gymName,
    identityState: parsed.fighterIdentity.state,
    stateChangedYear: parsed.fighterIdentity.stateChangedYear,
    stateChangedWeek: parsed.fighterIdentity.stateChangedWeek,
    weightClassId: parsed.competition.weightClassId,
    competitionStatus: parsed.competition.status,
    wins: parsed.competition.amateur.wins + parsed.competition.pro.wins,
    losses: parsed.competition.amateur.losses + parsed.competition.pro.losses,
    kos: parsed.competition.pro.knockouts,
    southpaw: parsed.style.southpaw,
    styleTendency: parsed.style.currentTendency,
    tendencyStrength: parsed.style.tendencyStrength,
    // Dev mode: all soul traits revealed — ocean rule does not apply here.
    soulTraits: parsed.soulTraits.map(t => ({ traitId: t.traitId })),
    developedAttributes: parsed.developedAttributes.map(a => ({
      attributeId: a.attributeId,
      current: a.current,
      ceiling: a.currentPotential,
    })),
    physicalProfile: {
      heightCm: parsed.physicalProfile.heightCm,
      reachCm: parsed.physicalProfile.reachCm,
      weightKg: parsed.physicalProfile.weightKg,
      handSize: parsed.physicalProfile.handSize,
      neckThickness: parsed.physicalProfile.neckThickness,
      boneDensity: parsed.physicalProfile.boneDensity,
      bodyProportions: parsed.physicalProfile.bodyProportions,
    },
    coachQuality,
    lastBouts,
  }
}

export function getDevAttributeDistribution(
  db: Database.Database,
  saveId: string,
  attributeId: string,
  nationId: string | null,
): AttributeDistributionResult {
  let sql = 'SELECT data FROM persons WHERE saveId = ?'
  const params: unknown[] = [saveId]

  if (nationId !== null && nationId !== '') {
    sql += ' AND nationId = ?'
    params.push(nationId)
  }

  const rows = db.prepare(sql).all(...params) as Array<{ data: string }>

  const values: number[] = []
  for (const row of rows) {
    const parsed = JSON.parse(row.data) as unknown
    if (!isFighter(parsed)) continue
    // Only competing fighters — their attributes are what the bout simulation is
    // calibrated against. Aspiring/unaware/retired would skew the distribution.
    if (parsed.fighterIdentity.state !== 'competing') continue

    const attr = parsed.developedAttributes.find(a => a.attributeId === attributeId)
    if (attr !== undefined) {
      values.push(attr.current)
    }
  }

  // distribution[i] = count of fighters with value (i + 1)
  const distribution = new Array<number>(20).fill(0)
  for (const v of values) {
    const idx = Math.min(Math.max(Math.round(v) - 1, 0), 19)
    distribution[idx]++
  }

  if (values.length === 0) {
    return {
      attribute: attributeId,
      distribution,
      stats: { mean: 0, median: 0, min: 0, max: 0, stdDev: 0 },
    }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  const min = sorted[0] ?? 0
  const max = sorted[sorted.length - 1] ?? 0
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  const stdDev = Math.sqrt(variance)

  return {
    attribute: attributeId,
    distribution,
    stats: {
      mean: Math.round(mean * 10) / 10,
      median: Math.round(median * 10) / 10,
      min,
      max,
      stdDev: Math.round(stdDev * 10) / 10,
    },
  }
}

export function getDevBoutLog(
  db: Database.Database,
  saveId: string,
  filters: DevBoutFilters,
): { bouts: BoutLogEntry[]; summary: BoutLogSummary } {
  const limit = filters.limit ?? 200

  const boutRows = db
    .prepare(`
      SELECT id, circuitLevel, fighterAId, fighterBId, scheduledRounds, result
      FROM bouts
      WHERE saveId = ? AND status = 'completed'
      ORDER BY rowid DESC
      LIMIT ?
    `)
    .all(saveId, limit) as Array<{
      id: string
      circuitLevel: string
      fighterAId: string
      fighterBId: string
      scheduledRounds: number
      result: string | null
    }>

  // Parse results and collect unique fighter IDs for bulk name lookup.
  type ParsedRow = { row: typeof boutRows[0]; result: BoutResolutionResult }
  const parsedRows: ParsedRow[] = []
  const fighterIds = new Set<string>()

  for (const row of boutRows) {
    if (row.result === null) continue
    const result = JSON.parse(row.result) as BoutResolutionResult
    parsedRows.push({ row, result })
    if (result.winnerId !== null && result.winnerId !== 'draw') fighterIds.add(result.winnerId)
    if (result.loserId !== null && result.loserId !== 'draw') fighterIds.add(result.loserId)
  }

  // Bulk load fighter names in a single query.
  const nameMap = new Map<string, string>()
  if (fighterIds.size > 0) {
    const idList = Array.from(fighterIds)
    const placeholders = idList.map(() => '?').join(',')
    const nameRows = db
      .prepare(`SELECT id, data FROM persons WHERE saveId = ? AND id IN (${placeholders})`)
      .all(saveId, ...idList) as Array<{ id: string; data: string }>

    for (const nr of nameRows) {
      const nd = JSON.parse(nr.data) as { name: { first: string; surname: string } }
      nameMap.set(nr.id, formatInitial(nd.name.first, nd.name.surname))
    }
  }

  const bouts: BoutLogEntry[] = []
  for (const { row, result } of parsedRows) {
    if (
      filters.method !== undefined &&
      filters.method !== '' &&
      result.method !== filters.method
    ) continue

    const { year, week } = parseYearWeekFromBoutId(row.id)

    const fighterAName =
      result.winnerId !== null && result.winnerId !== 'draw'
        ? (nameMap.get(result.winnerId) ?? 'Unknown')
        : 'Draw'

    const fighterBName =
      result.loserId !== null && result.loserId !== 'draw'
        ? (nameMap.get(result.loserId) ?? 'Unknown')
        : 'Draw'

    bouts.push({
      boutId: row.id,
      year,
      week,
      circuitLevel: row.circuitLevel,
      fighterAName,
      fighterBName,
      winnerId: result.winnerId,
      method: result.method,
      endRound: result.endRound,
      scheduledRounds: result.scheduledRounds,
    })
  }

  // Compute summary statistics — the most important health check for the simulation.
  const total = bouts.length
  const koTko = bouts.filter(b => b.method === 'ko' || b.method === 'tko').length
  const decision = bouts.filter(
    b => b.method === 'decision' || b.method === 'split_decision' || b.method === 'majority_decision',
  ).length
  const splitMajority = bouts.filter(
    b => b.method === 'split_decision' || b.method === 'majority_decision',
  ).length
  const avgEndRound =
    total > 0 ? Math.round((bouts.reduce((s, b) => s + b.endRound, 0) / total) * 10) / 10 : 0
  const avgScheduledRounds =
    total > 0 ? Math.round((bouts.reduce((s, b) => s + b.scheduledRounds, 0) / total) * 10) / 10 : 0

  return {
    bouts,
    summary: { total, koTko, decision, splitMajority, avgEndRound, avgScheduledRounds },
  }
}

export function getDevGymFinancials(
  db: Database.Database,
  saveId: string,
  gymId: string,
): GymFinancialDetail | null {
  const row = db
    .prepare('SELECT data FROM gyms WHERE id = ? AND saveId = ?')
    .get(gymId, saveId) as { data: string } | undefined

  if (row === undefined) return null

  const gym = JSON.parse(row.data) as Gym

  // Group equipment by typeId — multiple instances of same equipment type are summarised.
  const equipMap = new Map<string, { count: number; totalCondition: number }>()
  for (const item of gym.equipment) {
    const entry = equipMap.get(item.typeId) ?? { count: 0, totalCondition: 0 }
    entry.count++
    entry.totalCondition += item.condition
    equipMap.set(item.typeId, entry)
  }

  const equipment: GymEquipmentSummary[] = Array.from(equipMap.entries()).map(([typeId, e]) => ({
    typeId,
    instanceCount: e.count,
    avgCondition: Math.round(e.totalCondition / e.count),
  }))

  return {
    gymId: gym.id,
    name: gym.name,
    cityId: gym.cityId,
    nationId: gym.nationId,
    gymTier: gym.gymTier,
    balance: gym.finances.balance,
    monthlyRent: gym.finances.monthlyRent,
    memberCount: gym.memberIds.length,
    fighterCount: gym.fighterIds.length,
    revenueHistory: gym.finances.revenueHistory.map(r => ({
      year: r.year,
      week: r.week,
      income: r.income,
      outgoings: r.outgoings,
      balance: r.balance,
      note: r.note,
    })),
    equipment,
  }
}

export function getDevGymList(
  db: Database.Database,
  saveId: string,
): GymListItem[] {
  const rows = db
    .prepare('SELECT data FROM gyms WHERE saveId = ?')
    .all(saveId) as Array<{ data: string }>

  return rows.map(row => {
    const gym = JSON.parse(row.data) as Gym
    return { id: gym.id, name: gym.name, cityId: gym.cityId, nationId: gym.nationId }
  })
}
