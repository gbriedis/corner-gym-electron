import type { JSX } from 'react'
import { useGameStore } from '../store/gameStore'
import GameShell from '../components/layout/GameShell'
import Button from '../components/Button'

// Game screen placeholder — proves the new game + load flow works end to end.
// No simulation logic lives here yet.
export default function Game(): JSX.Element {
  const worldState = useGameStore((s) => s.worldState)
  const clearWorld = useGameStore((s) => s.clearWorld)
  const setScreen = useGameStore((s) => s.setScreen)

  function handleNavigate(id: string): void {
    if (id === 'calendar') {
      setScreen('calendar')
    }
    // Other nav items — screens not yet implemented are no-ops for now
  }

  if (worldState === null) {
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
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-text-muted)',
          }}
        >
          No world loaded.
        </p>
      </div>
    )
  }

  function handleExit(): void {
    clearWorld()
    setScreen('mainMenu')
  }

  return (
    <GameShell activeNav="gym" onNavigate={handleNavigate}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 'var(--space-2)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            color: 'var(--color-accent-amber)',
          }}
        >
          Welcome, {worldState.playerName}.
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-text-primary)',
          }}
        >
          {worldState.gymName} is yours.
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            marginTop: 'var(--space-1)',
          }}
        >
          Year {worldState.currentYear} · Week {worldState.currentWeek}
        </p>

        <div style={{ marginTop: 'var(--space-8)' }}>
          <Button variant="ghost" size="sm" onClick={handleExit}>
            Exit to Main Menu
          </Button>
        </div>
      </div>
    </GameShell>
  )
}
