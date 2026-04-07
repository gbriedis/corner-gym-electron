import { useState, useEffect, type JSX } from 'react'
import { useGameStore } from '../store/gameStore'
import { listSaves, loadSave, deleteSave } from '../ipc/client'
import type { SaveSummary } from '../electron'

export default function LoadGame(): JSX.Element {
  const setScreen = useGameStore((s) => s.setScreen)
  const loadWorld = useGameStore((s) => s.loadWorld)
  const [saves, setSaves] = useState<SaveSummary[]>([])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listSaves()
      .then(setSaves)
      .catch((err: unknown) => setError(String(err)))
  }, [])

  function handleLoad(saveId: string): void {
    loadSave(saveId)
      .then(({ worldState, persons }) => {
        loadWorld(worldState, persons)
        setScreen('game')
      })
      .catch((err: unknown) => setError(String(err)))
  }

  function handleDelete(saveId: string): void {
    deleteSave(saveId)
      .then(() => {
        setSaves((prev) => prev.filter((s) => s.id !== saveId))
        setConfirmDelete(null)
      })
      .catch((err: unknown) => setError(String(err)))
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="w-screen h-screen bg-gray-950 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl px-6">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-white text-xl font-bold tracking-wide">Load Game</h2>
          <button
            onClick={() => setScreen('mainMenu')}
            className="text-gray-500 hover:text-gray-300 text-sm uppercase tracking-wide"
          >
            Back
          </button>
        </div>

        {error !== null && (
          <p className="mb-4 text-red-400 text-sm">{error}</p>
        )}

        {saves.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-600 text-sm">No saves found.</p>
            <button
              onClick={() => setScreen('newGame')}
              className="mt-4 text-gray-400 hover:text-white text-sm underline"
            >
              Start a new game
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {saves.map((save) => (
              <div
                key={save.id}
                className="bg-gray-900 border border-gray-800 px-4 py-3 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{save.saveName}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {save.cityId} · {save.difficulty} · Week {save.currentWeek}, {save.currentYear}
                  </p>
                  <p className="text-gray-600 text-xs mt-0.5">
                    Last played {formatDate(save.lastPlayedAt)}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  {confirmDelete === save.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(save.id)}
                        className="px-3 py-1 bg-red-900 hover:bg-red-800 text-red-300 text-xs uppercase tracking-wide"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs uppercase tracking-wide"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmDelete(save.id)}
                        className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-500 hover:text-red-400 text-xs uppercase tracking-wide transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => handleLoad(save.id)}
                        className="px-3 py-1 bg-white hover:bg-gray-200 text-gray-900 text-xs font-medium uppercase tracking-wide transition-colors"
                      >
                        Load
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
