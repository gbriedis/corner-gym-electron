// backrun simulates 10 years of boxing history before the player arrives.
// Calls advanceWeek() 520 times starting from (startYear - 10).
// All simulation in memory — SQLite writes happen in year-end batches.
//
// The same advanceWeek() used here is used during live play.
// The only difference is isBackrun=true suppresses player-facing outputs.
//
// Progress callback allows the loading screen to show meaningful updates.
// Year-end callback allows the caller to persist changes to SQLite in annual
// batches without the engine needing to import better-sqlite3.

import { createRng } from '../utils/rng.js'
import { advanceWeek } from '../engine/advanceWeek.js'
import { generateCalendar } from './calendar.js'

import type { AdvanceWeekState, BackrunProgress } from '../types/advanceWeek.js'
import type { WorldState } from '../types/worldState.js'
import type { Person } from '../types/person.js'
import type { Fighter } from '../types/fighter.js'
import type { Gym } from '../types/gym.js'
import type { Coach } from '../types/coach.js'
import type { CalendarEvent } from '../types/calendar.js'
import type { GameData } from '../data/loader.js'
import type { GameConfig } from '../types/gameConfig.js'
import type { BoutResolutionResult } from '../types/resolution.js'
import type { AttributeHistoryEvent } from '../types/fighter.js'

// YearEndBatch contains all accumulated changes from one simulated year.
// Passed to the onYearEnd callback so the desktop layer can persist them
// to SQLite without the engine needing a database dependency.
export interface YearEndBatch {
  saveId: string
  year: number
  pendingBoutResults: BoutResolutionResult[]
  // fighterId → attribute history events for this year
  pendingAttributeEvents: Map<string, AttributeHistoryEvent[]>
  pendingFighterUpdates: Set<string>
  pendingNewFighterIds: Set<string>
  pendingGymUpdates: Set<string>
  fighters: Map<string, Fighter>
  gyms: Map<string, Gym>
}

// clearPendingState resets the accumulated pending sets/maps after a batch write.
// Called after each year-end write so the next year starts clean.
function clearPendingState(state: AdvanceWeekState): void {
  state.pendingBoutResults = []
  state.pendingAttributeEvents = new Map()
  state.pendingFighterUpdates = new Set()
  state.pendingNewFighterIds = new Set()
  state.pendingGymUpdates = new Set()
}

// buildBackrunCalendar generates a full 10-year event calendar for the backrun period.
// generateCalendar covers startYear + startYear+1, so we call it in 2-year steps
// to build events for all 10 simulated years.
// Using a dedicated RNG offset avoids consuming from the main simulation RNG.
function buildBackrunCalendar(
  worldState: WorldState,
  config: GameConfig,
  data: GameData,
  startYear: number,
  rng: ReturnType<typeof createRng>,
): CalendarEvent[] {
  const allEvents: CalendarEvent[] = []

  for (let yearOffset = 0; yearOffset < 10; yearOffset += 2) {
    const yr = startYear + yearOffset
    const yearState = { ...worldState, currentYear: yr, currentWeek: 1 }
    const events = generateCalendar(yr, 1, { ...config, startYear: yr }, data, rng, yearState)
    allEvents.push(...events)
  }

  return allEvents
}

// buildInitialState constructs the full AdvanceWeekState from the generated world.
// The start year is config.startYear - 10 — we simulate a full decade of history
// before the player arrives so the world has real fighters with real records.
function buildInitialState(
  worldState: WorldState,
  persons: Person[],
  fighters: Fighter[],
  gyms: Gym[],
  coaches: Coach[],
  _calendar: CalendarEvent[],
  config: GameConfig,
  data: GameData,
  rng: ReturnType<typeof createRng>,
): AdvanceWeekState {
  const personMap = new Map<string, Person>()
  const fighterIds = new Set(fighters.map(f => f.id))

  for (const p of persons) {
    // Only store non-fighter persons in the persons map.
    // Fighters have their own map — they extend Person but carry much more state.
    if (!fighterIds.has(p.id)) {
      personMap.set(p.id, p)
    }
  }

  const fighterMap = new Map<string, Fighter>()
  const backrunStartYear = config.startYear - 10
  for (const f of fighters) {
    // Aspiring fighters have made the commitment to compete — pre-register them.
    // In the live game, a player-managed fighter gets registered through the inbox.
    // In the backrun, we skip that administrative step and register them directly
    // so they can enter their first club card and get a real bout record.
    if (
      f.competition.status === 'unregistered' &&
      (f.fighterIdentity.state === 'aspiring' || f.fighterIdentity.state === 'competing')
    ) {
      f.competition.status = 'amateur'
    }
    // Veterans generated with statistical careers have lastBoutYear=null.
    // Without a real bout date, weeklyTick treats them as 999-weeks inactive and
    // immediately regresses their mental attributes to 1 before they can fight.
    // Set lastBoutYear to just before the backrun so regression doesn't fire on week 1.
    const hasBoutRecord = f.competition.amateur.wins + f.competition.amateur.losses > 0
    if (hasBoutRecord && f.career.lastBoutYear === null) {
      f.career.lastBoutYear = backrunStartYear
      f.career.lastBoutWeek = rng.nextInt(1, 52)
    }
    fighterMap.set(f.id, f)
  }

  const gymMap = new Map<string, Gym>()
  for (const g of gyms) {
    gymMap.set(g.id, g)
  }

  const coachMap = new Map<string, Coach>()
  for (const c of coaches) {
    coachMap.set(c.id, c)
  }

  const startYear = config.startYear - 10

  // Generate a 10-year calendar for the backrun period.
  // The initial calendar from generateWorld only covers the player's starting years —
  // the backrun needs events for the full decade of simulated history.
  const backrunCalendar = buildBackrunCalendar(worldState, config, data, startYear, rng)

  return {
    year: startYear,
    week: 1,
    worldState: { ...worldState, currentYear: startYear, currentWeek: 1 },
    persons: personMap,
    fighters: fighterMap,
    gyms: gymMap,
    coaches: coachMap,
    calendar: backrunCalendar,
    pendingBoutResults: [],
    pendingAttributeEvents: new Map(),
    pendingFighterUpdates: new Set(),
    pendingNewFighterIds: new Set(),
    pendingGymUpdates: new Set(),
    annualRetirementCount: {},
  }
}

// runBackrun simulates 10 years of boxing history in memory.
// onYearEnd is called at the end of each simulated year with all changes
// accumulated that year — the caller can persist these to SQLite.
// onProgress reports simulation progress for the loading screen.
export async function runBackrun(
  worldState: WorldState,
  persons: Person[],
  fighters: Fighter[],
  gyms: Gym[],
  coaches: Coach[],
  calendar: CalendarEvent[],
  data: GameData,
  config: GameConfig,
  saveId: string,
  onYearEnd?: (batch: YearEndBatch) => void,
  onProgress?: (progress: BackrunProgress) => void,
): Promise<AdvanceWeekState> {
  const rng = createRng(config.seed)
  const state = buildInitialState(worldState, persons, fighters, gyms, coaches, calendar, config, data, rng)

  const startYear = config.startYear - 10
  let totalBoutsSimulated = 0
  let totalIdentityTransitions = 0

  // 520 weeks = 10 years × 52 weeks/year
  for (let tick = 0; tick < 520; tick++) {
    const result = advanceWeek(state, data, rng, true)

    totalBoutsSimulated += result.boutsResolved
    totalIdentityTransitions += result.identityTransitions

    // Year-end processing when week has just rolled over from 52 to 1.
    // advanceWeek increments week before returning, so when week is now 1
    // we just completed the previous year (state.year has already incremented).
    // We trigger year-end when we've completed exactly 52 ticks (one year).
    const completedYear = tick > 0 && (tick + 1) % 52 === 0

    if (completedYear) {
      const year = startYear + Math.floor((tick + 1) / 52)

      if (onYearEnd !== undefined) {
        onYearEnd({
          saveId,
          year,
          pendingBoutResults: [...state.pendingBoutResults],
          pendingAttributeEvents: new Map(state.pendingAttributeEvents),
          pendingFighterUpdates: new Set(state.pendingFighterUpdates),
          pendingNewFighterIds: new Set(state.pendingNewFighterIds),
          pendingGymUpdates: new Set(state.pendingGymUpdates),
          fighters: state.fighters,
          gyms: state.gyms,
        })
      }

      clearPendingState(state)

      onProgress?.({
        year,
        boutsSimulated: totalBoutsSimulated,
        identityTransitions: totalIdentityTransitions,
        message: `Year ${year} — ${totalBoutsSimulated} bouts simulated`,
      })

      // Yield to the event loop periodically so the loading screen stays responsive.
      // Without this the backrun would block the main thread for the entire 10-year run.
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    }
  }

  // Final write — any remaining pending changes after the last full year
  if (
    state.pendingBoutResults.length > 0 ||
    state.pendingFighterUpdates.size > 0 ||
    state.pendingGymUpdates.size > 0
  ) {
    onYearEnd?.({
      saveId,
      year: config.startYear,
      pendingBoutResults: [...state.pendingBoutResults],
      pendingAttributeEvents: new Map(state.pendingAttributeEvents),
      pendingFighterUpdates: new Set(state.pendingFighterUpdates),
      pendingNewFighterIds: new Set(state.pendingNewFighterIds),
      pendingGymUpdates: new Set(state.pendingGymUpdates),
      fighters: state.fighters,
      gyms: state.gyms,
    })
    clearPendingState(state)
  }

  return state
}
