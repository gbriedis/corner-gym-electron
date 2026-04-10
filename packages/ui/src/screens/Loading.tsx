import { useState, useEffect, useRef, type JSX } from 'react'
import { useGameStore } from '../store/gameStore'
import { onGenerationProgress, onBackrunProgress, loadSave, getGameData } from '../ipc/client'
import type { ProgressEvent, BackrunProgressEvent } from '../electron'
import ProgressBar from '../components/ProgressBar'

// World gen steps before backrun starts — progress is 0–50%.
const GEN_STEPS = ['Loading game data', 'Generating population', 'Generating world', 'Saving to database']

function genStepToPercent(step: string): number {
  const idx = GEN_STEPS.indexOf(step)
  if (idx === -1) return 5
  // Gen steps cover 0–50%; backrun covers 50–100%
  return Math.round(((idx + 1) / GEN_STEPS.length) * 50)
}

export default function Loading(): JSX.Element {
  const setScreen = useGameStore((s) => s.setScreen)
  const loadWorld = useGameStore((s) => s.loadWorld)
  const setGameData = useGameStore((s) => s.setGameData)
  const pendingSaveId = useGameStore((s) => s.pendingSaveId)

  const [latest, setLatest] = useState<ProgressEvent | null>(null)
  const [backrun, setBackrun] = useState<BackrunProgressEvent | null>(null)
  const [startMs] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const unsubscribe = onGenerationProgress((event) => {
      setLatest(event)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = onBackrunProgress((event) => {
      setBackrun(event)
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

    // Load the save and game data in parallel — both are needed before entering the game.
    // gameData contains static JSON (venues, rules, circuits) used by detail pages.
    Promise.all([loadSave(pendingSaveId), getGameData()])
      .then(([{ worldState, persons }, gameData]) => {
        loadWorld(worldState, persons)
        setGameData(gameData)
        setScreen('game')
      })
      .catch(console.error)
  }, [pendingSaveId, latest, loadWorld, setScreen, setGameData])

  // Backrun progress covers 50–100%. Each year-end event updates the bar.
  const isInBackrun = latest !== null && latest.step === 'Generating world history'
  let percent: number
  if (backrun !== null) {
    percent = 50 + Math.round(backrun.percent / 2)
  } else if (latest !== null) {
    percent = genStepToPercent(latest.step)
  } else {
    percent = 5
  }

  const stepLabel = isInBackrun
    ? 'Generating world history...'
    : (latest !== null ? latest.step : 'Starting…')

  const detailLabel = isInBackrun && backrun !== null
    ? `Year ${backrun.year} · ${backrun.boutsSimulated} bouts simulated`
    : (latest !== null ? latest.detail : '')

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
          {stepLabel}
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
          {detailLabel}
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
