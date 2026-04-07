// Corner Gym Engine — Public API
// Exports only what the desktop/UI layer needs via IPC.
// This module has zero UI or Electron dependencies.

// Types — exported so desktop can use them for IPC typing
export type { Person } from './types/person.js'
export type { Fighter } from './types/fighter.js'
export type { Gym } from './types/gym.js'
export type { Location } from './types/location.js'
export type { GameEvent } from './types/event.js'
export type { Bout } from './types/bout.js'
export type { Moment } from './types/moment.js'
export type { WorldState } from './types/worldState.js'

// advanceWeek — the single entry point the desktop calls each week tick.
// Takes current world state, returns updated world state + surfaces for the inbox/popups.
export { advanceWeek } from './engine/advanceWeek.js'
