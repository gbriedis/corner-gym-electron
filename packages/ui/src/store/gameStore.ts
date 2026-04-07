import { create } from 'zustand'
import type { WorldState, Person } from '@corner-gym/engine'

type Screen = 'mainMenu' | 'newGame' | 'loadGame' | 'loading' | 'game'

interface GameStore {
  worldState: WorldState | null
  persons: Person[]
  currentScreen: Screen
  pendingSaveId: string | null
  setScreen: (screen: Screen) => void
  setPendingSaveId: (saveId: string | null) => void
  loadWorld: (worldState: WorldState, persons: Person[]) => void
  clearWorld: () => void
}

export const useGameStore = create<GameStore>()((set) => ({
  worldState: null,
  persons: [],
  currentScreen: 'mainMenu',
  pendingSaveId: null,

  setScreen: (screen) => set({ currentScreen: screen }),

  // pendingSaveId is set by NewGame once generate-and-save resolves.
  // Loading reads it and triggers loadSave to complete the transition to game.
  setPendingSaveId: (saveId) => set({ pendingSaveId: saveId }),

  loadWorld: (worldState, persons) => set({ worldState, persons }),

  clearWorld: () => set({ worldState: null, persons: [], pendingSaveId: null }),
}))
