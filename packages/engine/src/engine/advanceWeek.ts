// advanceWeek is the single tick of the simulation.
// Called 520 times by the backrun to generate 10 years of history.
// Called once per in-game week during live play.
//
// Order matters:
// 1. weeklyTick — decay, finances, inactivity (always runs)
// 2. identityTick — state transitions (always runs)
// 3. eventTick — event resolution (only if events scheduled this week)
//
// For the backrun: no inbox events, no moments, no player notifications.
// For live play: advanceWeek will eventually surface results to the inbox.
// The isBackrun flag suppresses all player-facing outputs so the same function
// works in both contexts without diverging implementations.

import { runWeeklyTick, advancePersonAges } from './weeklyTick.js'
import { runIdentityTick } from './identityTick.js'
import { runEventTick } from './eventTick.js'

import type { AdvanceWeekState, AdvanceWeekResult } from '../types/advanceWeek.js'
import type { GameData } from '../data/loader.js'
import type { RNG } from '../utils/rng.js'

export function advanceWeek(
  state: AdvanceWeekState,
  data: GameData,
  rng: RNG,
  isBackrun: boolean = false,
): AdvanceWeekResult {
  // 1. Weekly background — always runs regardless of scheduled events
  runWeeklyTick(state, data, rng)

  // 2. Identity — fighter life stage transitions
  const identityTransitions = runIdentityTick(state, data, rng)

  // 3. Events — resolve bouts, tournaments, and other scheduled events
  const boutsResolved = runEventTick(state, data, rng)
  const eventsProcessed = state.calendar.filter(
    e => e.year === state.year && e.week === state.week && e.status === 'completed',
  ).length

  // Advance the week counter.
  // Year rollover at week 52 — increment year, reset week, age everyone.
  // Age advancement runs once per year so it lives in the year boundary,
  // not in weeklyTick where it would require a modular check every week.
  state.week += 1
  if (state.week > 52) {
    state.week = 1
    state.year += 1
    advancePersonAges(state, data)
    state.worldState.currentYear = state.year
    state.worldState.currentWeek = state.week
  } else {
    state.worldState.currentWeek = state.week
  }

  // In live play this would surface inbox events, popups, and moments.
  // Suppressed during backrun to avoid generating output no one reads.
  if (!isBackrun) {
    // Future: populate inbox, trigger moments
  }

  return { state, eventsProcessed, boutsResolved, identityTransitions }
}
