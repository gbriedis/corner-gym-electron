// Corner Gym Engine — Public API
// Exports only what the desktop/UI layer needs via IPC.
// This module has zero UI or Electron dependencies.

// Types — exported so desktop can use them for IPC typing
export type { Person } from './types/person.js'
export type { WorldState, GymState, CityState, NationState } from './types/worldState.js'
export type { GameConfig, DifficultyModifiers, LeagueSettings, WorldSettings } from './types/gameConfig.js'
export { resolveModifiers } from './types/gameConfig.js'
export type { CalendarEvent, CalendarData, EventStatus } from './types/calendar.js'
export type {
  Bout, BoutStatus, BoutMethod, BoutResult, JudgeScorecard,
  Card, CardVisibility,
  TournamentBracket, TournamentEntrant, TournamentRound,
  MultiDayEvent, MultiDaySession,
  RulesData, AgeCategory, CircuitRules, ScoringSystem,
} from './types/competition.js'

// Generation — exported so desktop can call generateWorld via IPC
export { generateWorld } from './generation/world.js'

// Data loading — exported so desktop can call loadGameData at startup
export { loadGameData } from './data/loader.js'

// advanceWeek — the single entry point the desktop calls each week tick.
// Takes current world state, returns updated world state + surfaces for the inbox/popups.
export { advanceWeek } from './engine/advanceWeek.js'
