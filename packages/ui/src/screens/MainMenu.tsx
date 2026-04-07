import type { JSX } from 'react'
import { useGameStore } from '../store/gameStore'
import Button from '../components/Button'

export default function MainMenu(): JSX.Element {
  const setScreen = useGameStore((s) => s.setScreen)

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--color-bg-dark)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* CSS-only grain/noise overlay for atmosphere */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
          pointerEvents: 'none',
          opacity: 0.5,
        }}
      />

      {/* Logotype */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '64px',
          color: 'var(--color-accent-amber)',
          letterSpacing: '0.04em',
          marginBottom: 'var(--space-2)',
          userSelect: 'none',
        }}
      >
        Corner Gym
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          color: 'var(--color-text-muted)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: 'var(--space-12)',
        }}
      >
        Boxing Management
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: '220px' }}>
        <Button variant="primary" size="lg" onClick={() => setScreen('newGame')}>
          New Game
        </Button>
        <Button variant="secondary" size="lg" onClick={() => setScreen('loadGame')}>
          Load Game
        </Button>
        <Button variant="ghost" size="lg" onClick={() => window.close()}>
          Quit
        </Button>
      </div>
    </div>
  )
}
