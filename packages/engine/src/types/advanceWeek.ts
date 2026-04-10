// Types for the weekly simulation tick.
// AdvanceWeekState is the full in-memory world state during simulation.
// Passed into advanceWeek(), mutated, returned.
// Never stored to SQLite mid-simulation — only written in year-end batches
// via the backrun's batchWrite callback.

import type { WorldState } from './worldState.js'
import type { Person } from './person.js'
import type { Fighter, AttributeHistoryEvent } from './fighter.js'
import type { Gym } from './gym.js'
import type { Coach } from './coach.js'
import type { CalendarEvent } from './calendar.js'
import type { BoutResolutionResult } from './resolution.js'

export interface AdvanceWeekState {
  year: number
  week: number                    // 1-52
  worldState: WorldState
  persons: Map<string, Person>
  fighters: Map<string, Fighter>
  gyms: Map<string, Gym>
  coaches: Map<string, Coach>
  calendar: CalendarEvent[]
  // Accumulated changes since last SQLite write
  pendingBoutResults: BoutResolutionResult[]
  pendingAttributeEvents: Map<string, AttributeHistoryEvent[]>  // fighterId → events
  pendingFighterUpdates: Set<string>   // fighter ids that need SQLite update
  pendingGymUpdates: Set<string>
}

export interface AdvanceWeekResult {
  state: AdvanceWeekState
  eventsProcessed: number
  boutsResolved: number
  identityTransitions: number
}

export interface BackrunProgress {
  year: number
  boutsSimulated: number
  identityTransitions: number
  message: string
}
