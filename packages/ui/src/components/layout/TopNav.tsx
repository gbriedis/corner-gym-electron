// TopNav — fixed top bar for the game UI.
// Three zones: left (back/forward + page name), centre (reserved), right (week/finances/advance).
// Replaces TopBar for all in-game screens.

import type { JSX } from 'react'
import { ArrowLeftIcon, ArrowRightIcon } from '@radix-ui/react-icons'
import { useGameStore } from '../../store/gameStore'
import type { Screen } from '../../store/gameStore'

const PAGE_NAMES: Partial<Record<Screen, string>> = {
  game:            'DASHBOARD',
  calendar:        'CALENDAR',
  eventFull:       'EVENT',
  venue:           'VENUE',
  sanctioningBody: 'FEDERATION',
}

// Separator — single-pixel vertical rule between zones.
function Separator(): JSX.Element {
  return (
    <div
      style={{
        width: '1px',
        height: '24px',
        backgroundColor: 'var(--color-bg-mid)',
        flexShrink: 0,
        margin: '0 var(--space-3)',
      }}
    />
  )
}

export default function TopNav(): JSX.Element {
  const currentScreen  = useGameStore((s) => s.currentScreen)
  const worldState     = useGameStore((s) => s.worldState)
  const setScreen      = useGameStore((s) => s.setScreen)
  const navHistory     = useGameStore((s) => s.navHistory)
  const navFuture      = useGameStore((s) => s.navFuture)
  const navigateBack   = useGameStore((s) => s.navigateBack)
  const navigateForward = useGameStore((s) => s.navigateForward)

  const pageName   = PAGE_NAMES[currentScreen] ?? ''
  // Never navigate back past the game screen.
  // The game screen is the root of in-game navigation — going back further
  // would return the player to the new game or load screens, losing context.
  const canGoBack  = currentScreen !== 'game' && navHistory.length > 0
  const canGoForward = navFuture.length > 0

  const weekDisplay = worldState !== null
    ? `WEEK ${worldState.currentWeek} · ${worldState.currentYear}`
    : '—'

  const arrowStyle = (enabled: boolean): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    padding: '4px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.3,
    pointerEvents: enabled ? 'auto' : 'none',
    color: 'var(--color-text-muted)',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  })

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--color-text-muted)',
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '48px',
        backgroundColor: 'var(--color-bg-dark)',
        borderBottom: '1px solid var(--color-bg-mid)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-3)',
        zIndex: 200,
        gap: 0,
      }}
    >
      {/* ── Left zone: back/forward arrows + page name ───────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
        <button
          onClick={navigateBack}
          disabled={!canGoBack}
          style={arrowStyle(canGoBack)}
          aria-label="Go back"
        >
          <ArrowLeftIcon width={16} height={16} />
        </button>
        <button
          onClick={navigateForward}
          disabled={!canGoForward}
          style={arrowStyle(canGoForward)}
          aria-label="Go forward"
        >
          <ArrowRightIcon width={16} height={16} />
        </button>

        <Separator />

        {/* Page name — clicking navigates to the main game screen */}
        <button
          onClick={() => setScreen('game')}
          style={{
            ...labelStyle,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          {pageName}
        </button>
      </div>

      {/* ── Centre zone: reserved, takes remaining space ─────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ── Right zone: week/year, finances placeholder, advance week ──────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
        <span style={labelStyle}>{weekDisplay}</span>

        <Separator />

        {/* Finances placeholder — will be wired when finances module is built */}
        <span style={{ ...labelStyle, color: 'rgba(218,212,201,0.35)' }}>€ —</span>

        <Separator />

        {/* Advance Week — skeleton only, no logic wired yet */}
        <button
          onClick={() => { /* advance week logic goes here */ }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            backgroundColor: 'var(--color-accent-amber)',
            color: 'var(--color-bg-dark)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 16px',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          Advance Week
        </button>
      </div>
    </div>
  )
}
