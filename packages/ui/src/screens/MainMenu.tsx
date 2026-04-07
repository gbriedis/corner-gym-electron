import type { JSX } from 'react'
import { useGameStore } from '../store/gameStore'

export default function MainMenu(): JSX.Element {
  const setScreen = useGameStore((s) => s.setScreen)

  return (
    <div className="w-screen h-screen bg-gray-950 flex flex-col items-center justify-center gap-10">
      <h1 className="text-white text-4xl font-bold tracking-widest uppercase">Corner Gym</h1>

      <div className="flex flex-col gap-3 w-56">
        <button
          onClick={() => setScreen('newGame')}
          className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium tracking-wide uppercase transition-colors"
        >
          New Game
        </button>

        <button
          onClick={() => setScreen('loadGame')}
          className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium tracking-wide uppercase transition-colors"
        >
          Load Game
        </button>

        <button
          onClick={() => window.close()}
          className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white text-sm font-medium tracking-wide uppercase transition-colors"
        >
          Quit
        </button>
      </div>
    </div>
  )
}
