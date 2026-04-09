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

// HistoryEntry stores a screen + its params together so navigateBack/Forward
// restores both the screen and the state it was navigated to with.
interface HistoryEntry {
  screen: Screen
  params: NavigationParams | null
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
  // Navigation history — lets TopNav back/forward arrows work without a browser router.
  navHistory: HistoryEntry[]
  navFuture: HistoryEntry[]
  setScreen: (screen: Screen, params?: NavigationParams) => void
  navigateBack: () => void
  navigateForward: () => void
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
  navHistory: [],
  navFuture: [],

  setScreen: (screen, params) => set((state) => ({
    currentScreen: screen,
    navigationParams: params ?? null,
    // Push the outgoing screen into history so back arrow can return to it.
    navHistory: [...state.navHistory, { screen: state.currentScreen, params: state.navigationParams }],
    // Any new navigation clears forward history — you can't go forward after choosing a new path.
    navFuture: [],
  })),

  navigateBack: () => set((state) => {
    if (state.navHistory.length === 0) return state
    const prev = state.navHistory[state.navHistory.length - 1]!
    return {
      currentScreen: prev.screen,
      navigationParams: prev.params,
      navHistory: state.navHistory.slice(0, -1),
      navFuture: [{ screen: state.currentScreen, params: state.navigationParams }, ...state.navFuture],
    }
  }),

  navigateForward: () => set((state) => {
    if (state.navFuture.length === 0) return state
    const next = state.navFuture[0]!
    return {
      currentScreen: next.screen,
      navigationParams: next.params,
      navHistory: [...state.navHistory, { screen: state.currentScreen, params: state.navigationParams }],
      navFuture: state.navFuture.slice(1),
    }
  }),

  setPendingSaveId: (saveId) => set({ pendingSaveId: saveId }),

  loadWorld: (worldState, persons) => set({ worldState, persons }),

  setGameData: (data) => set({ gameData: data }),

  clearWorld: () => set({ worldState: null, persons: [], pendingSaveId: null, gameData: null, navHistory: [], navFuture: [] }),
}))
