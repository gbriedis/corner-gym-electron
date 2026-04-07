import { useState, useEffect, useRef, type JSX } from 'react'
import { useGameStore } from '../store/gameStore'
import { onGenerationProgress, loadSave } from '../ipc/client'
import type { ProgressEvent } from '../electron'
import ProgressBar from '../components/ProgressBar'

// Steps in generation order — used to compute progress percentage.
const STEPS = ['Preparing', 'Cities', 'Persons', 'Done']

function stepToPercent(step: string): number {
  const idx = STEPS.indexOf(step)
  if (idx === -1) return 5
  return Math.round(((idx + 1) / STEPS.length) * 100)
}

export default function Loading(): JSX.Element {
  const setScreen = useGameStore((s) => s.setScreen)
  const loadWorld = useGameStore((s) => s.loadWorld)
  const pendingSaveId = useGameStore((s) => s.pendingSaveId)

  const [latest, setLatest] = useState<ProgressEvent | null>(null)
  const [startMs] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const unsubscribe = onGenerationProgress((event) => {
      setLatest(event)
    })
    return unsubscribe
  }, [])

  // Tick a wall-clock timer so elapsed always updates even between progress events.
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startMs)
    }, 200)
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current)
    }
  }, [startMs])

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

  const percent = latest !== null ? stepToPercent(latest.step) : 5
  const elapsedSec = (elapsed / 1000).toFixed(1)

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--color-bg-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 var(--space-6)' }}>
        {/* Step */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-1)',
          }}
        >
          {latest !== null ? latest.step : 'Starting…'}
        </p>

        {/* Detail */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            marginBottom: 'var(--space-4)',
            minHeight: '16px',
          }}
        >
          {latest !== null ? latest.detail : ''}
        </p>

        <ProgressBar value={percent} showPercent />

        {/* Elapsed — bottom right, small */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 'var(--space-3)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '10px',
              color: 'var(--color-text-muted)',
              opacity: 0.6,
            }}
          >
            {elapsedSec}s
          </span>
        </div>
      </div>
    </div>
  )
}
