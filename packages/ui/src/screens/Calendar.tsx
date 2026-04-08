import { useState, useEffect, type JSX } from 'react'
import { CalendarIcon, SewingPinIcon, ClockIcon } from '@radix-ui/react-icons'
import GameShell from '../components/layout/GameShell'
import Badge from '../components/Badge'
import Icon from '../components/Icon'
import { useGameStore } from '../store/gameStore'
import { getUpcomingEvents } from '../ipc/client'

import type { CalendarEvent } from '@corner-gym/engine'
import type { BadgeVariant } from '../components/Badge'

// MONTH_NAMES provides readable section headers for the grouped event list.
const MONTH_NAMES: Record<number, string> = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April',
  5: 'May', 6: 'June', 7: 'July', 8: 'August',
  9: 'September', 10: 'October', 11: 'November', 12: 'December',
}

// WEEK_TO_MONTH maps ISO week numbers to approximate month numbers.
// Weeks do not divide evenly into months — this is the canonical month
// for each week used throughout the calendar system.
function weekToMonth(week: number): number {
  if (week <= 4)  return 1
  if (week <= 8)  return 2
  if (week <= 13) return 3
  if (week <= 17) return 4
  if (week <= 21) return 5
  if (week <= 26) return 6
  if (week <= 30) return 7
  if (week <= 34) return 8
  if (week <= 39) return 9
  if (week <= 43) return 10
  if (week <= 48) return 11
  return 12
}

// weekToDateRange converts a week number and year to a human-readable date range string.
// The range is approximate — ISO week 1 starts on the Monday containing Jan 4th.
// Precise date arithmetic is not worth the complexity for a display-only label.
function weekToDateRange(week: number, year: number): string {
  // Approximate: each week is ~7 days, week 1 starts ~Jan 1
  const dayOfYear = (week - 1) * 7 + 1
  const date = new Date(year, 0, dayOfYear)
  const endDate = new Date(year, 0, dayOfYear + 6)
  const fmt = (d: Date): string =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(date)} – ${fmt(endDate)}`
}

// circuitLevelBadge maps circuit level ids to Badge variants.
// Prestige increases from neutral (club) through amber (national) to extreme (world/olympic).
function circuitLevelBadge(level: CalendarEvent['circuitLevel']): BadgeVariant {
  switch (level) {
    case 'club_tournament':      return 'neutral'
    case 'regional_open':        return 'normal'
    case 'national_championship': return 'hard'
    case 'baltic_championship':  return 'hard'
    case 'european_championship': return 'extreme'
    case 'world_championship':   return 'extreme'
    case 'olympics':             return 'extreme'
  }
}

function circuitLevelLabel(level: CalendarEvent['circuitLevel']): string {
  switch (level) {
    case 'club_tournament':      return 'Club'
    case 'regional_open':        return 'Regional'
    case 'national_championship': return 'National'
    case 'baltic_championship':  return 'Baltic'
    case 'european_championship': return 'European'
    case 'world_championship':   return 'World'
    case 'olympics':             return 'Olympics'
  }
}

function statusBadge(status: CalendarEvent['status']): BadgeVariant {
  switch (status) {
    case 'scheduled':   return 'neutral'
    case 'in_progress': return 'easy'
    case 'completed':   return 'neutral'
    case 'cancelled':   return 'extreme'
  }
}

export default function Calendar(): JSX.Element {
  const worldState = useGameStore((s) => s.worldState)
  const setScreen = useGameStore((s) => s.setScreen)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (worldState === null) return

    getUpcomingEvents(worldState.saveId, worldState.currentWeek, worldState.currentYear)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [worldState])

  function handleNavigate(id: string): void {
    if (id !== 'calendar') {
      // Navigate away from calendar — other game screens are stubs for now,
      // so return to the main game screen for non-implemented items.
      setScreen('game')
    }
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
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          No world loaded.
        </p>
      </div>
    )
  }

  // Group events by year+month for section rendering.
  const grouped = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const month = weekToMonth(event.week)
    const key = `${event.year}-${month.toString().padStart(2, '0')}`
    const existing = grouped.get(key) ?? []
    existing.push(event)
    grouped.set(key, existing)
  }
  const sortedKeys = Array.from(grouped.keys()).sort()

  return (
    <GameShell activeNav="calendar" onNavigate={handleNavigate}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <Icon icon={CalendarIcon} size="lg" color="var(--color-accent-amber)" />
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            color: 'var(--color-accent-amber)',
            margin: 0,
          }}
        >
          Boxing Calendar
        </h1>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            marginLeft: 'var(--space-2)',
          }}
        >
          {worldState.currentYear}
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Loading events…
        </p>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 'var(--space-12)',
          }}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
            No events scheduled.
          </p>
        </div>
      )}

      {/* Event groups by month */}
      {!loading && sortedKeys.map((key) => {
        const [yearStr, monthStr] = key.split('-')
        const year = parseInt(yearStr ?? '0', 10)
        const month = parseInt(monthStr ?? '0', 10)
        const monthEvents = grouped.get(key) ?? []

        return (
          <section key={key} style={{ marginBottom: 'var(--space-8)' }}>
            {/* Month header */}
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--color-text-muted)',
                borderBottom: 'var(--border-subtle)',
                paddingBottom: 'var(--space-2)',
                marginBottom: 'var(--space-3)',
              }}
            >
              {MONTH_NAMES[month] ?? month} {year}
            </div>

            {/* Event cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {monthEvents.map((event) => (
                <div
                  key={event.id}
                  style={{
                    backgroundColor: 'rgba(218, 212, 201, 0.04)',
                    border: 'var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3) var(--space-4)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 'var(--space-2) var(--space-4)',
                    alignItems: 'start',
                  }}
                >
                  {/* Left: event name + meta */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {event.label}
                      </span>
                      <Badge variant={circuitLevelBadge(event.circuitLevel)} label={circuitLevelLabel(event.circuitLevel)} />
                    </div>

                    {/* Venue */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <Icon icon={SewingPinIcon} size="sm" color="var(--color-text-muted)" />
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px' }}>
                        {event.venueId.replace(/_/g, ' ')} · {event.cityId.replace(/.*-/, '')}
                      </span>
                    </div>

                    {/* Date range */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <Icon icon={ClockIcon} size="sm" color="var(--color-text-muted)" />
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px' }}>
                        Week {event.week} · {weekToDateRange(event.week, event.year)}
                      </span>
                    </div>
                  </div>

                  {/* Right: status badge */}
                  <div style={{ paddingTop: 'var(--space-1)' }}>
                    <Badge
                      variant={statusBadge(event.status)}
                      label={event.status}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </GameShell>
  )
}
