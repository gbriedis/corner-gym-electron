// Calendar screen — month grid view of the full boxing calendar.
// Events are placed on the Saturday of their ISO week (the traditional fight-night day).
// Clicking an event pill opens a detail panel on the right.
// Navigate with ← → arrows, keyboard arrow keys, or the Today button.

import { useState, useEffect, useCallback, type JSX } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  SewingPinIcon,
  PersonIcon,
  Cross2Icon,
} from '@radix-ui/react-icons'
import GameShell from '../components/layout/GameShell'
import Badge from '../components/Badge'
import Icon from '../components/Icon'
import { useGameStore } from '../store/gameStore'
import { getAllEvents } from '../ipc/client'

import type { CalendarEvent } from '@corner-gym/engine'
import type { BadgeVariant } from '../components/Badge'

// All venue images pre-loaded as URL strings by Vite at build time.
// Only files that exist in assets/venues/ appear in this map.
// Missing venue images (most venues) produce undefined → styled placeholder.
const VENUE_IMAGES = import.meta.glob('../assets/venues/*.{jpg,png,jpeg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

function getVenueImageSrc(venueId: string): string | null {
  return (
    VENUE_IMAGES[`../assets/venues/${venueId}.jpg`] ??
    VENUE_IMAGES[`../assets/venues/${venueId}.png`] ??
    VENUE_IMAGES[`../assets/venues/${venueId}.jpeg`] ??
    VENUE_IMAGES[`../assets/venues/${venueId}.webp`] ??
    null
  )
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// weekToMonth converts an ISO week number to its approximate calendar month.
// Used to determine the starting view month from the current in-game week.
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

// isoWeekSaturday returns the Saturday of the given ISO week and year.
// Boxing events are displayed on Saturday — the traditional fight-night day —
// which gives the grid a concrete date anchor without needing day-level data.
function isoWeekSaturday(year: number, week: number): Date {
  // ISO week 1 always contains January 4th.
  const jan4 = new Date(year, 0, 4)
  const dow = (jan4.getDay() + 6) % 7  // Mon=0 … Sun=6
  const week1Mon = new Date(jan4)
  week1Mon.setDate(jan4.getDate() - dow)
  const targetMon = new Date(week1Mon)
  targetMon.setDate(week1Mon.getDate() + (week - 1) * 7)
  const sat = new Date(targetMon)
  sat.setDate(targetMon.getDate() + 5)
  return sat
}

// buildMonthCells returns an array of day numbers (1–N) padded with null for
// empty leading/trailing cells so the 7-column Mon–Sun grid renders correctly.
function buildMonthCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1)
  const totalDays = new Date(year, month, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7  // Mon=0
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

// eventsOnDay returns all events whose fight-night Saturday falls on this date.
function eventsOnDay(
  events: CalendarEvent[],
  year: number,
  month: number,
  day: number,
): CalendarEvent[] {
  return events.filter(event => {
    const sat = isoWeekSaturday(event.year, event.week)
    return (
      sat.getFullYear() === year &&
      sat.getMonth() + 1 === month &&
      sat.getDate() === day
    )
  })
}

// circuitBadgeVariant maps a circuit level to a Badge variant for prestige display.
function circuitBadgeVariant(level: CalendarEvent['circuitLevel']): BadgeVariant {
  switch (level) {
    case 'club_tournament':       return 'neutral'
    case 'regional_open':         return 'normal'
    case 'national_championship': return 'hard'
    case 'baltic_championship':   return 'hard'
    case 'european_championship': return 'extreme'
    case 'world_championship':    return 'extreme'
    case 'olympics':              return 'extreme'
  }
}

function circuitLabel(level: CalendarEvent['circuitLevel']): string {
  switch (level) {
    case 'club_tournament':       return 'Club'
    case 'regional_open':         return 'Regional'
    case 'national_championship': return 'National'
    case 'baltic_championship':   return 'Baltic'
    case 'european_championship': return 'European'
    case 'world_championship':    return 'World'
    case 'olympics':              return 'Olympics'
  }
}

function statusBadgeVariant(status: CalendarEvent['status']): BadgeVariant {
  switch (status) {
    case 'scheduled':   return 'neutral'
    case 'in_progress': return 'easy'
    case 'completed':   return 'neutral'
    case 'cancelled':   return 'extreme'
  }
}

// pillStyle returns inline styles for an event pill in the grid cell.
// Prestige increases from muted club events to glowing Olympics pills.
function pillStyle(level: CalendarEvent['circuitLevel']): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '1px 4px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '9px',
    lineHeight: '14px',
    fontFamily: 'var(--font-body)',
    fontWeight: 400,
    cursor: 'pointer',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    textAlign: 'left',
    border: 'none',
    marginBottom: '1px',
  }
  switch (level) {
    case 'club_tournament':
      return { ...base, background: 'rgba(218,212,201,0.08)', color: 'rgba(218,212,201,0.5)' }
    case 'regional_open':
      return { ...base, background: 'rgba(90,139,222,0.15)', color: 'var(--color-accent-blue)' }
    case 'national_championship':
      return { ...base, background: 'rgba(238,178,74,0.18)', color: 'var(--color-accent-amber)', fontWeight: 600 }
    case 'baltic_championship':
      return { ...base, background: 'rgba(255,209,131,0.2)', color: 'var(--color-accent-gold)', fontWeight: 600, fontSize: '10px' }
    case 'european_championship':
      return { ...base, background: 'rgba(255,209,131,0.22)', color: 'var(--color-accent-gold)', fontWeight: 700, fontSize: '10px' }
    case 'world_championship':
      return { ...base, background: 'rgba(220,98,80,0.2)', color: 'var(--color-accent-red)', fontWeight: 700, fontSize: '10px' }
    case 'olympics':
      return {
        ...base,
        background: 'rgba(255,209,131,0.25)',
        color: 'var(--color-accent-gold)',
        fontWeight: 700,
        fontSize: '10px',
        boxShadow: '0 0 6px rgba(255,209,131,0.35)',
        border: '1px solid rgba(255,209,131,0.3)',
      }
  }
}

// formatCityDisplay builds a readable "City, Country" string for the detail panel.
function formatCityDisplay(event: CalendarEvent): string {
  if (event.countryDisplay !== undefined) {
    // International event — cityId and countryDisplay are plain lowercase strings.
    const city = event.cityId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const country = event.countryDisplay.replace(/\b\w/g, c => c.toUpperCase())
    return `${city}, ${country}`
  }
  // Domestic event — cityId is "nation-city".
  const cityShort = event.cityId.replace(/^[^-]+-/, '')
  return cityShort.replace(/\b\w/g, c => c.toUpperCase())
}

// formatWeightClass converts a weight class id to a readable label.
// e.g. "light_heavyweight" → "Light Heavyweight"
function formatWeightClass(id: string): string {
  return id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// displayVenueName returns the venue name for display.
// Falls back to a formatted venueId for saves generated before venueName was added.
function displayVenueName(event: CalendarEvent): string {
  if (event.venueName !== '') return event.venueName
  return event.venueId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// governingBody returns the full name of the sanctioning body for a circuit level.
// Hardcoded because this is static data — saves an IPC round-trip.
function governingBody(level: CalendarEvent['circuitLevel']): string {
  switch (level) {
    case 'club_tournament':
    case 'regional_open':
    case 'national_championship':
      return 'Latvian Boxing Federation (LBF)'
    case 'baltic_championship':
    case 'european_championship':
      return 'European Boxing Confederation (EUBC)'
    case 'world_championship':
    case 'olympics':
      return 'International Boxing Association (IBA)'
  }
}

// participatingNations returns a display string for international events.
function participatingNations(level: CalendarEvent['circuitLevel']): string | null {
  switch (level) {
    case 'baltic_championship':
      return 'Latvia · Lithuania · Estonia'
    case 'european_championship':
      return 'All EUBC member nations'
    case 'world_championship':
    case 'olympics':
      return 'All IBA member nations'
    default:
      return null
  }
}

// selectionMethod returns entry info for international events.
function selectionMethod(level: CalendarEvent['circuitLevel']): string | null {
  switch (level) {
    case 'baltic_championship':
    case 'european_championship':
      return 'Open entry — apply through LBF'
    case 'world_championship':
    case 'olympics':
      return 'Federation selection — apply through LBF'
    default:
      return null
  }
}

// VenueImage renders an image if available, or a styled placeholder.
// Never shows a broken img tag — the fallback always renders something legible.
function VenueImage({ venueId, venueName, isOlympics }: {
  venueId: string
  venueName: string
  isOlympics: boolean
}): JSX.Element {
  const [imgError, setImgError] = useState(false)
  const src = getVenueImageSrc(venueId)
  const height = isOlympics ? '160px' : '120px'

  if (src === null || imgError) {
    return (
      <div
        style={{
          width: '100%',
          height,
          backgroundColor: '#0d0f13',
          border: 'var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '10px',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            padding: '0 var(--space-3)',
          }}
        >
          {venueName}
        </span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={venueName}
      onError={() => setImgError(true)}
      style={{
        width: '100%',
        height,
        objectFit: 'cover',
        borderRadius: 'var(--radius-md)',
        display: 'block',
      }}
    />
  )
}

// EventDetailPanel renders the right-side panel when an event is selected.
function EventDetailPanel({ event, onClose }: {
  event: CalendarEvent
  onClose: () => void
}): JSX.Element {
  const isOlympics = event.circuitLevel === 'olympics'
  const isNational = event.circuitLevel === 'national_championship'
  const isInternational = [
    'baltic_championship', 'european_championship', 'world_championship', 'olympics',
  ].includes(event.circuitLevel)

  const sat = isoWeekSaturday(event.year, event.week)
  const dateStr = sat.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const nations = participatingNations(event.circuitLevel)
  const entryMethod = selectionMethod(event.circuitLevel)

  // Olympics gets a gold panel accent; national gets an amber one; others get default.
  const accentColor = isOlympics
    ? 'var(--color-accent-gold)'
    : isNational
      ? 'var(--color-accent-amber)'
      : 'var(--color-text-muted)'

  const borderColor = isOlympics
    ? 'rgba(255,209,131,0.25)'
    : 'rgba(218,212,201,0.08)'

  return (
    <div
      style={{
        width: '320px',
        flexShrink: 0,
        backgroundColor: 'rgba(10,10,14,0.6)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: isOlympics ? '0 0 24px rgba(255,209,131,0.08)' : 'none',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: isOlympics ? '14px' : '12px',
              fontWeight: 700,
              color: accentColor,
              marginBottom: 'var(--space-1)',
              lineHeight: 1.3,
            }}
          >
            {event.label}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge variant={circuitBadgeVariant(event.circuitLevel)} label={circuitLabel(event.circuitLevel)} />
            <Badge variant={statusBadgeVariant(event.status)} label={event.status} />
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            flexShrink: 0,
            lineHeight: 1,
          }}
          aria-label="Close"
        >
          <Cross2Icon width={14} height={14} />
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3) var(--space-4)' }}>
        {/* Olympics special header */}
        {isOlympics && (
          <div
            style={{
              background: 'rgba(255,209,131,0.06)',
              border: '1px solid rgba(255,209,131,0.15)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              marginBottom: 'var(--space-3)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'var(--color-accent-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
              Every 4 years
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--color-accent-gold)' }}>
              {event.year}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'rgba(255,209,131,0.6)', marginTop: '2px' }}>
              The pinnacle of amateur boxing
            </div>
          </div>
        )}

        {/* Venue image */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <VenueImage venueId={event.venueId} venueName={displayVenueName(event)} isOlympics={isOlympics} />
        </div>

        {/* Location */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              marginBottom: '2px',
            }}
          >
            {displayVenueName(event)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <SewingPinIcon width={11} height={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {formatCityDisplay(event)}
            </span>
          </div>
        </div>

        {/* Date */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Row label="Date" value={dateStr} />
        </div>

        {/* Capacity */}
        {event.venueCapacity > 0 && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Row label="Capacity" value={event.venueCapacity.toLocaleString()} />
          </div>
        )}

        {/* Governing body */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Row label="Sanctioned by" value={governingBody(event.circuitLevel)} />
        </div>

        {/* National championship city rotation note */}
        {isNational && (
          <div
            style={{
              background: 'rgba(238,178,74,0.06)',
              border: '1px solid rgba(238,178,74,0.12)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-accent-amber)', fontWeight: 600, marginBottom: '2px' }}>
              Latvian Boxing Federation
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
              Hosted in {formatCityDisplay(event)} this year
            </div>
          </div>
        )}

        {/* International event info */}
        {isInternational && nations !== null && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <SectionLabel label="Participating Nations" />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                marginTop: 'var(--space-1)',
              }}
            >
              <PersonIcon width={11} height={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                {nations}
              </span>
            </div>
          </div>
        )}

        {isInternational && entryMethod !== null && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Row label="Entry" value={entryMethod} />
          </div>
        )}

        {/* Weight classes */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <SectionLabel label="Weight Classes" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'var(--space-1)' }}>
            {event.weightClasses.map(wc => (
              <span
                key={wc}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '9px',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(218,212,201,0.06)',
                  border: 'var(--border-subtle)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {formatWeightClass(wc)}
              </span>
            ))}
          </div>
        </div>

        {/* Entry slots — structure exists but activation comes with roster system */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <SectionLabel label="Entry Slots" />
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '9px',
              color: 'rgba(218,212,201,0.35)',
              fontStyle: 'italic',
              margin: 'var(--space-1) 0 var(--space-2)',
            }}
          >
            Fighter entry available once gym roster is set up.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {event.weightClasses.map(wc => (
              <div
                key={wc}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px var(--space-2)',
                  background: 'rgba(218,212,201,0.03)',
                  border: 'var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                  {formatWeightClass(wc)}
                </span>
                <button
                  disabled
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '9px',
                    padding: '2px 6px',
                    background: 'rgba(218,212,201,0.06)',
                    border: 'var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'rgba(218,212,201,0.25)',
                    cursor: 'not-allowed',
                  }}
                >
                  Enter Fighter
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// SectionLabel renders a small all-caps label for detail panel sections.
function SectionLabel({ label }: { label: string }): JSX.Element {
  return (
    <div
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '9px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'rgba(218,212,201,0.35)',
        marginBottom: '2px',
      }}
    >
      {label}
    </div>
  )
}

// Row renders a label+value pair for the detail panel.
function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
      <SectionLabel label={label} />
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
        {value}
      </span>
    </div>
  )
}

export default function Calendar(): JSX.Element {
  const worldState = useGameStore(s => s.worldState)
  const setScreen = useGameStore(s => s.setScreen)

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  // Start at current in-game month/year.
  const startMonth = worldState !== null ? weekToMonth(worldState.currentWeek) : 1
  const startYear = worldState?.currentYear ?? new Date().getFullYear()
  const [viewMonth, setViewMonth] = useState(startMonth)
  const [viewYear, setViewYear] = useState(startYear)

  // Approximate "today" in-game: Saturday of current week.
  const todaySat = worldState !== null
    ? isoWeekSaturday(worldState.currentYear, worldState.currentWeek)
    : null

  useEffect(() => {
    if (worldState === null) return
    getAllEvents(worldState.saveId)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [worldState])

  const navigatePrevMonth = useCallback((): void => {
    setViewMonth(m => {
      if (m === 1) {
        setViewYear(y => y - 1)
        return 12
      }
      return m - 1
    })
    setSelectedEvent(null)
  }, [])

  const navigateNextMonth = useCallback((): void => {
    setViewMonth(m => {
      if (m === 12) {
        setViewYear(y => y + 1)
        return 1
      }
      return m + 1
    })
    setSelectedEvent(null)
  }, [])

  const navigateToday = useCallback((): void => {
    if (worldState === null) return
    setViewMonth(weekToMonth(worldState.currentWeek))
    setViewYear(worldState.currentYear)
    setSelectedEvent(null)
  }, [worldState])

  // Keyboard arrow navigation for months; Escape closes the detail panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'ArrowLeft')  navigatePrevMonth()
      if (e.key === 'ArrowRight') navigateNextMonth()
      if (e.key === 'Escape')     setSelectedEvent(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigatePrevMonth, navigateNextMonth])

  function handleNavigate(id: string): void {
    if (id !== 'calendar') setScreen('game')
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

  const cells = buildMonthCells(viewYear, viewMonth)

  // Upcoming events — starting from the current in-game week, up to 10.
  // Events are already sorted year+week ascending from the DB.
  const upcomingEvents = events
    .filter(e =>
      e.year > worldState.currentYear ||
      (e.year === worldState.currentYear && e.week >= worldState.currentWeek),
    )
    .slice(0, 10)

  return (
    <GameShell activeNav="calendar" onNavigate={handleNavigate}>
      {/* Screen header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <Icon icon={CalendarIcon} size="lg" color="var(--color-accent-amber)" />
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            color: 'var(--color-accent-amber)',
            margin: 0,
            flex: 1,
          }}
        >
          Boxing Calendar
        </h1>

        {/* Today button */}
        <button
          onClick={navigateToday}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            padding: '4px 10px',
            background: 'rgba(218,212,201,0.06)',
            border: 'var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          Today
        </button>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            onClick={navigatePrevMonth}
            aria-label="Previous month"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeftIcon width={16} height={16} />
          </button>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              minWidth: '130px',
              textAlign: 'center',
            }}
          >
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            onClick={navigateNextMonth}
            aria-label="Next month"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronRightIcon width={16} height={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Loading calendar…
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
          {/* Calendar grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Day-of-week headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '1px',
                marginBottom: '2px',
              }}
            >
              {DAY_HEADERS.map(d => (
                <div
                  key={d}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '9px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'rgba(218,212,201,0.35)',
                    textAlign: 'center',
                    padding: '4px 0',
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '1px',
              }}
            >
              {cells.map((day, idx) => {
                const dayEvents = day !== null
                  ? eventsOnDay(events, viewYear, viewMonth, day)
                  : []

                const isToday =
                  todaySat !== null &&
                  day !== null &&
                  todaySat.getFullYear() === viewYear &&
                  todaySat.getMonth() + 1 === viewMonth &&
                  todaySat.getDate() === day

                return (
                  <div
                    key={idx}
                    style={{
                      minHeight: '72px',
                      background: day === null
                        ? 'transparent'
                        : isToday
                          ? 'rgba(238,178,74,0.05)'
                          : 'rgba(218,212,201,0.02)',
                      border: day === null
                        ? 'none'
                        : isToday
                          ? '1px solid rgba(238,178,74,0.2)'
                          : 'var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    {day !== null && (
                      <>
                        {/* Day number */}
                        <div
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '10px',
                            color: isToday
                              ? 'var(--color-accent-amber)'
                              : 'rgba(218,212,201,0.35)',
                            textAlign: 'right',
                            marginBottom: '2px',
                            fontWeight: isToday ? 700 : 400,
                          }}
                        >
                          {day}
                        </div>

                        {/* Event pills */}
                        {dayEvents.map(event => (
                          <button
                            key={event.id}
                            onClick={() => setSelectedEvent(event)}
                            style={pillStyle(event.circuitLevel)}
                            title={event.label}
                          >
                            {circuitLabel(event.circuitLevel)}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
                marginTop: 'var(--space-4)',
                paddingTop: 'var(--space-3)',
                borderTop: 'var(--border-subtle)',
              }}
            >
              {(
                [
                  ['club_tournament', 'Club Tournament'],
                  ['regional_open', 'Regional Open'],
                  ['national_championship', 'National Championship'],
                  ['baltic_championship', 'Baltic Championship'],
                  ['european_championship', 'European Championship'],
                  ['world_championship', 'World Championship'],
                  ['olympics', 'Olympics'],
                ] as [CalendarEvent['circuitLevel'], string][]
              ).map(([level, label]) => (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ ...pillStyle(level), width: '10px', height: '10px', display: 'block', padding: 0, borderRadius: '2px', marginBottom: 0 }} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'rgba(218,212,201,0.4)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Event detail panel */}
          {selectedEvent !== null && (
            <EventDetailPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          )}
        </div>
      )}

      {/* Upcoming events list */}
      {!loading && upcomingEvents.length > 0 && (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '9px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'rgba(218,212,201,0.35)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Upcoming Events
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {upcomingEvents.map(event => {
              const sat = isoWeekSaturday(event.year, event.week)
              const dateStr = sat.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              const isSelected = selectedEvent?.id === event.id
              return (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 80px 1fr auto',
                    gap: 'var(--space-3)',
                    alignItems: 'center',
                    padding: '6px var(--space-3)',
                    background: isSelected
                      ? 'rgba(218,212,201,0.06)'
                      : 'rgba(218,212,201,0.02)',
                    border: isSelected
                      ? 'var(--border-mid)'
                      : 'var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {/* Date */}
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'rgba(218,212,201,0.45)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {dateStr} {event.year}
                  </span>

                  {/* Circuit badge */}
                  <span style={{ ...pillStyle(event.circuitLevel), marginBottom: 0, width: 'auto' }}>
                    {circuitLabel(event.circuitLevel)}
                  </span>

                  {/* Event name */}
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {event.label}
                  </span>

                  {/* Venue + city */}
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'rgba(218,212,201,0.4)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      maxWidth: '180px',
                      textAlign: 'right',
                    }}
                  >
                    {displayVenueName(event)} · {formatCityDisplay(event)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </GameShell>
  )
}
