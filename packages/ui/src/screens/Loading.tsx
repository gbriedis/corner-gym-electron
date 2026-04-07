import { useState, useEffect, type JSX } from 'react'
import { useGameStore } from '../store/gameStore'
import { onGenerationProgress, loadSave } from '../ipc/client'
import type { ProgressEvent } from '../electron'

export default function Loading(): JSX.Element {
  const setScreen = useGameStore((s) => s.setScreen)
  const loadWorld = useGameStore((s) => s.loadWorld)
  const pendingSaveId = useGameStore((s) => s.pendingSaveId)

  const [events, setEvents] = useState<ProgressEvent[]>([])
  const [latest, setLatest] = useState<ProgressEvent | null>(null)

  useEffect(() => {
    // Listen for progress events emitted by the main process during generation.
    const unsubscribe = onGenerationProgress((event) => {
      setLatest(event)
      setEvents((prev) => [...prev, event])
    })
    return unsubscribe
  }, [])

  // Once generate-and-save resolves (pendingSaveId set) and the 'Done' event fires,
  // load the save from SQLite and transition to the game screen.
  useEffect(() => {
    if (pendingSaveId === null) return
    if (latest === null || latest.step !== 'Done') return

    loadSave(pendingSaveId)
      .then(({ worldState, persons }) => {
        loadWorld(worldState, persons)
        setScreen('game')
      })
      .catch(console.error)
  }, [pendingSaveId, latest, loadWorld, setScreen])

  return (
    <div className="w-screen h-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />

      <div className="text-center">
        <p className="text-white text-sm font-medium">
          {latest !== null ? latest.step : 'Starting…'}
        </p>
        <p className="text-gray-500 text-xs mt-1">
          {latest !== null ? latest.detail : ''}
        </p>
        {latest !== null && (
          <p className="text-gray-600 text-xs mt-1 font-mono">
            {(latest.elapsedMs / 1000).toFixed(1)}s
          </p>
        )}
      </div>

      <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5 w-80">
        {events.slice(-8).map((e, i) => (
          <p key={i} className="text-gray-600 text-xs font-mono text-center">
            {e.step}: {e.detail}
          </p>
        ))}
      </div>
    </div>
  )
}
