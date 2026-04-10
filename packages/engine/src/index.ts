// Corner Gym Engine — Public API
// Exports only what the desktop/UI layer needs via IPC.
// This module has zero UI or Electron dependencies.

// Types — exported so desktop can use them for IPC typing
export type { Person } from './types/person.js'
export type { WorldState, CityState, NationState } from './types/worldState.js'
export type { GameConfig, DifficultyModifiers, LeagueSettings, WorldSettings } from './types/gameConfig.js'
export { resolveModifiers } from './types/gameConfig.js'
export type { CalendarEvent, CalendarData, EventStatus } from './types/calendar.js'
export type {
  Bout, BoutStatus, BoutMethod, BoutResult, BoutJudgeScore,
  Card, CardVisibility,
  TournamentBracket, TournamentEntrant, TournamentRound,
  MultiDayEvent, MultiDaySession,
  RulesData, AgeCategory, CircuitRules, ScoringSystem,
} from './types/competition.js'

// Fighter type and generation — exported for IPC typing and world pre-population
export type { Fighter } from './types/fighter.js'
export { generateFighter } from './generation/fighter.js'
export type { FighterGenerationOptions } from './generation/fighter.js'

// Gym type and generation — exported for IPC typing and save persistence
export type { Gym, GymTier, GymZone, GymZones, GymEquipmentItem, GymStaffMember, GymFinances, GymQuality, GymCulture, GymReputation } from './types/gym.js'
export { generateGym, calculateGymQuality, assignGymHeadCoach } from './generation/gym.js'
export type { GymGenerationOptions, GymFighterWithPerson } from './generation/gym.js'

// Coach type and generation — exported for IPC typing and save persistence
export type { Coach, CoachStyle, CoachFighterRelationship } from './types/coach.js'
export { generateCoach } from './generation/coach.js'
export type { CoachGenerationOptions } from './generation/coach.js'

// Generation — exported so desktop can call generateWorld via IPC
export { generateWorld } from './generation/world.js'

// Data loading — exported so desktop can call loadGameData at startup
export { loadGameData } from './data/loader.js'
export type { GameData, NationBundle, NationBoxingData, InternationalData } from './data/loader.js'

// Boxing data types — needed by UI pages for venue/sanctioning body/circuit display
export type {
  CircuitLevel,
  SanctioningBody,
  CircuitLevelDefinition,
  Venue,
  EventTemplate,
  EventDay,
} from './types/data/boxing.js'

// advanceWeek — the single entry point the desktop calls each week tick.
// Takes current world state, returns updated world state + surfaces for the inbox/popups.
export { advanceWeek } from './engine/advanceWeek.js'
