import type { JSX } from 'react'
import { useGameStore } from '../../store/gameStore'

interface Props {
  title: string
}

const SCREEN_TITLES: Record<string, string> = {
  mainMenu: '',
  newGame:  'New Game',
  loadGame: 'Load Game',
  loading:  'Generating…',
  game:     'Gym',
}

export default function TopBar({ title }: Props): JSX.Element {
  const worldState = useGameStore((s) => s.worldState)
  const currentScreen = useGameStore((s) => s.currentScreen)
  const inGame = currentScreen === 'game'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '44px',
        backgroundColor: 'var(--color-bg-dark)',
        borderBottom: 'var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-4)',
        zIndex: 200,
      }}
    >
      {/* Left — logotype */}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '15px',
          color: 'var(--color-accent-amber)',
          letterSpacing: '0.04em',
          userSelect: 'none',
        }}
      >
        Corner Gym
      </span>

      {/* Centre — screen title */}
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--color-text-muted)',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        {title !== '' ? title : SCREEN_TITLES[currentScreen] ?? ''}
      </span>

      {/* Right — gym + year/week, greyed out off-game */}
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          color: inGame ? 'var(--color-text-muted)' : 'rgba(218, 212, 201, 0.2)',
          letterSpacing: '0.06em',
          textAlign: 'right',
        }}
      >
        {inGame && worldState !== null
          ? `${worldState.gymName} · Y${worldState.currentYear} W${worldState.currentWeek}`
          : '—'}
      </span>
    </div>
  )
}
