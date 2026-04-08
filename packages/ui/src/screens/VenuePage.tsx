// VenuePage — full detail view for a boxing venue.
// Shows venue image, description, capacity, eligible circuit levels,
// and upcoming/past events at this venue queried from SQLite.

import { useState, useEffect, type JSX } from 'react'
import { ArrowLeftIcon, SewingPinIcon } from '@radix-ui/react-icons'
import GameShell from '../components/layout/GameShell'
import Badge from '../components/Badge'
import { useGameStore } from '../store/gameStore'
import { getAllEvents } from '../ipc/client'

import type { Venue, CircuitLevel } from '@corner-gym/engine'
import type { CalendarEvent } from '@corner-gym/engine'
import type { BadgeVariant } from '../components/Badge'

// ─── Helpers ────────────────────────────────────────────────────────────────

// Pre-loaded venue images via Vite glob import — same pattern as Calendar.tsx.
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

function circuitDisplayLabel(id: CircuitLevel): string {
  switch (id) {
    case 'club_card':             return 'Club Card'
    case 'regional_tournament':   return 'Regional Tournament'
    case 'national_championship': return 'National Championship'
    case 'baltic_championship':   return 'Baltic Championship'
    case 'european_championship': return 'European Championship'
    case 'world_championship':    return 'World Championship'
    case 'olympics':              return 'Olympics'
  }
}

function circuitBadgeVariant(id: CircuitLevel): BadgeVariant {
  switch (id) {
    case 'club_card':             return 'neutral'
    case 'regional_tournament':   return 'normal'
    case 'national_championship': return 'hard'
    case 'baltic_championship':   return 'easy'
    case 'european_championship': return 'normal'
    case 'world_championship':    return 'hard'
    case 'olympics':              return 'hard'
  }
}

function isoWeekSaturday(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4)
  const dow = (jan4.getDay() + 6) % 7
  const week1Mon = new Date(jan4)
  week1Mon.setDate(jan4.getDate() - dow)
  const targetMon = new Date(week1Mon)
  targetMon.setDate(week1Mon.getDate() + (week - 1) * 7)
  const sat = new Date(targetMon)
  sat.setDate(targetMon.getDate() + 5)
  return sat
}

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
        marginBottom: 'var(--space-2)',
      }}
    >
      {label}
    </div>
  )
}

// VenueHeroImage renders the 21:9 venue image or a styled placeholder.
function VenueHeroImage({ venueId, venueName }: { venueId: string; venueName: string }): JSX.Element {
  const [imgError, setImgError] = useState(false)
  const src = getVenueImageSrc(venueId)

  const containerStyle: React.CSSProperties = {
    width: '100%',
    aspectRatio: '21 / 9',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 'var(--space-4)',
  }

  if (src === null || imgError) {
    return (
      <div
        style={{
          ...containerStyle,
          backgroundColor: '#0d0f13',
          border: 'var(--border-subtle)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            padding: 'var(--space-4)',
          }}
        >
          {venueName}
        </span>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <img
        src={src}
        alt={venueName}
        onError={() => setImgError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
      />
      {/* Name overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 'var(--space-4)',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
          {venueName}
        </div>
      </div>
    </div>
  )
}

// EventListRow renders a compact event row for upcoming/past event lists.
function EventListRow({ event }: { event: CalendarEvent }): JSX.Element {
  const sat = isoWeekSaturday(event.year, event.week)
  const dateStr = sat.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) 0',
        borderBottom: 'var(--border-subtle)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.4)', minWidth: '90px', flexShrink: 0 }}>
        {dateStr}
      </span>
      <Badge variant={circuitBadgeVariant(event.circuitLevel)} label={circuitDisplayLabel(event.circuitLevel)} />
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {event.label}
      </span>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function VenuePage(): JSX.Element {
  const gameData = useGameStore(s => s.gameData)
  const worldState = useGameStore(s => s.worldState)
  const params = useGameStore(s => s.navigationParams)
  const setScreen = useGameStore(s => s.setScreen)

  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])

  const venueId = params?.venueId ?? ''

  // Load calendar events for this venue from SQLite.
  useEffect(() => {
    if (worldState === null) return
    getAllEvents(worldState.saveId)
      .then(setAllEvents)
      .catch(() => setAllEvents([]))
  }, [worldState])

  // Find venue across all venue lists.
  let venue: Venue | undefined
  if (gameData !== null) {
    for (const bundle of Object.values(gameData.nations)) {
      if (bundle.boxing !== undefined) {
        const found = bundle.boxing.venues.venues.find(v => v.id === venueId)
        if (found !== undefined) { venue = found; break }
      }
    }
    if (venue === undefined) {
      venue = gameData.international.boxing.venues.venues.find(v => v.id === venueId)
    }
  }

  const currentYear  = worldState?.currentYear ?? 9999
  const currentWeek  = worldState?.currentWeek  ?? 99

  const venueEvents = allEvents.filter(e => e.venueId === venueId)
  const upcomingEvents = venueEvents.filter(
    e => e.year > currentYear || (e.year === currentYear && e.week >= currentWeek),
  )
  const pastEvents = venueEvents.filter(
    e => e.year < currentYear || (e.year === currentYear && e.week < currentWeek),
  ).reverse()

  function handleBack(): void {
    setScreen('calendar')
  }

  function handleNavigate(id: string): void {
    if (id !== 'calendar') setScreen('game')
    else setScreen('calendar')
  }

  if (gameData === null) {
    return (
      <GameShell activeNav="calendar" onNavigate={handleNavigate}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>Loading data…</p>
      </GameShell>
    )
  }

  if (venue === undefined) {
    return (
      <GameShell activeNav="calendar" onNavigate={handleNavigate}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Venue not found: {venueId}
        </p>
      </GameShell>
    )
  }

  return (
    <GameShell activeNav="calendar" onNavigate={handleNavigate}>
      {/* Back button */}
      <button
        onClick={handleBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          marginBottom: 'var(--space-4)',
        }}
      >
        <ArrowLeftIcon width={12} height={12} />
        Back to Calendar
      </button>

      {/* Hero image with venue name overlay */}
      <VenueHeroImage venueId={venueId} venueName={venue.name} />

      {/* Venue meta below image */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <SewingPinIcon width={12} height={12} style={{ color: 'var(--color-text-muted)' }} />
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {venue.city.replace(/\b\w/g, c => c.toUpperCase())}, {venue.country.replace(/\b\w/g, c => c.toUpperCase())}
        </span>
        <span style={{ color: 'rgba(218,212,201,0.2)', fontSize: '10px' }}>·</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {venue.capacity.toLocaleString()} seats
        </span>
        {venue.formerName !== undefined && (
          <>
            <span style={{ color: 'rgba(218,212,201,0.2)', fontSize: '10px' }}>·</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(218,212,201,0.4)', fontStyle: 'italic' }}>
              fmr. {venue.formerName}
            </span>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start', maxWidth: '900px' }}>
        {/* Left column — description + eligible circuits */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* About */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <SectionLabel label="About" />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.7, margin: 0 }}>
              {venue.description}
            </p>
          </div>

          {/* Eligible for */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <SectionLabel label="Eligible Circuit Levels" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {venue.eligibleFor.map(level => (
                <Badge key={level} variant={circuitBadgeVariant(level)} label={circuitDisplayLabel(level)} />
              ))}
            </div>
          </div>
        </div>

        {/* Right column — upcoming + past events */}
        <div style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Upcoming events */}
          <div
            style={{
              background: 'rgba(10,10,14,0.4)',
              border: 'var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: 'var(--border-subtle)' }}>
              <SectionLabel label="Upcoming Events Here" />
            </div>
            <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
              {upcomingEvents.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.35)', margin: 0, fontStyle: 'italic' }}>
                  No upcoming events scheduled at this venue.
                </p>
              ) : (
                upcomingEvents.map(event => <EventListRow key={event.id} event={event} />)
              )}
            </div>
          </div>

          {/* Past events */}
          <div
            style={{
              background: 'rgba(10,10,14,0.4)',
              border: 'var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: 'var(--border-subtle)' }}>
              <SectionLabel label="Past Events Here" />
            </div>
            <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
              {pastEvents.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.35)', margin: 0, fontStyle: 'italic' }}>
                  No recorded events yet — this fills as the game progresses.
                </p>
              ) : (
                pastEvents.map(event => <EventListRow key={event.id} event={event} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  )
}
