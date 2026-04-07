import type { JSX } from 'react'
import { useGameStore } from '../store/gameStore'

// Game screen placeholder — proves the new game + load flow works end to end.
// No simulation logic lives here yet.
export default function Game(): JSX.Element {
  const worldState = useGameStore((s) => s.worldState)
  const setScreen = useGameStore((s) => s.setScreen)
  const clearWorld = useGameStore((s) => s.clearWorld)

  if (worldState === null) {
    return (
      <div className="w-screen h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-600 text-sm">No world loaded.</p>
      </div>
    )
  }

  function handleExit(): void {
    clearWorld()
    setScreen('mainMenu')
  }

  return (
    <div className="w-screen h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <p className="text-white text-xl font-medium">
        Welcome, {worldState.playerName}.
      </p>
      <p className="text-gray-400 text-base">
        {worldState.gymName} is yours.
      </p>
      <p className="text-gray-600 text-sm font-mono mt-2">
        Year {worldState.currentYear} · Week {worldState.currentWeek}
      </p>

      <button
        onClick={handleExit}
        className="mt-8 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs uppercase tracking-wide transition-colors"
      >
        Exit to Main Menu
      </button>
    </div>
  )
}
