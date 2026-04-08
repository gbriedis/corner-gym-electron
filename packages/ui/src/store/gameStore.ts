import { create } from 'zustand'
import type { WorldState, Person, GameData, CalendarEvent } from '@corner-gym/engine'

type Screen =
  | 'mainMenu'
  | 'newGame'
  | 'loadGame'
  | 'loading'
  | 'game'
  | 'calendar'
  | 'sanctioningBody'
  | 'venue'
  | 'eventFull'

// NavigationParams carries route-style params for screens that need an entity id.
// returnMonth/returnYear let the EventFullPage return to the correct calendar month.
interface NavigationParams {
  bodyId?: string
  venueId?: string
  eventId?: string
  calendarEvent?: CalendarEvent
  returnMonth?: number
  returnYear?: number
}

interface GameStore {
  worldState: WorldState | null
  persons: Person[]
  // gameData holds the loaded static JSON data (venues, rules, circuits, sanctioning bodies).
  // Populated once at game load so pages can read it without per-navigation IPC calls.
  gameData: GameData | null
  currentScreen: Screen
  navigationParams: NavigationParams | null
  pendingSaveId: string | null
  setScreen: (screen: Screen, params?: NavigationParams) => void
  setPendingSaveId: (saveId: string | null) => void
  loadWorld: (worldState: WorldState, persons: Person[]) => void
  setGameData: (data: GameData) => void
  clearWorld: () => void
}

export type { Screen, NavigationParams }

export const useGameStore = create<GameStore>()((set) => ({
  worldState: null,
  persons: [],
  gameData: null,
  currentScreen: 'mainMenu',
  navigationParams: null,
  pendingSaveId: null,

  setScreen: (screen, params) => set({ currentScreen: screen, navigationParams: params ?? null }),

  // pendingSaveId is set by NewGame once generate-and-save resolves.
  // Loading reads it and triggers loadSave to complete the transition to game.
  setPendingSaveId: (saveId) => set({ pendingSaveId: saveId }),

  loadWorld: (worldState, persons) => set({ worldState, persons }),

  setGameData: (data) => set({ gameData: data }),

  clearWorld: () => set({ worldState: null, persons: [], pendingSaveId: null, gameData: null }),
}))
