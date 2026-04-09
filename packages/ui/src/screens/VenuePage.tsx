// VenuePage — full detail view for a boxing venue.
// Shows full-bleed hero image, stat row, description, circuit eligibility,
// and upcoming/past events at this venue queried from SQLite.
// Styled as a worn boxing programme: no web-UI cards, stamp labels, divider rules.

import { useState, useEffect, type JSX, type ReactNode } from 'react'
import GameShell from '../components/layout/GameShell'
import Badge from '../components/Badge'
import { useGameStore } from '../store/gameStore'
import { getAllEvents } from '../ipc/client'

import type { Venue, CircuitLevel, CalendarEvent } from '@corner-gym/engine'
import type { BadgeVariant } from '../components/Badge'

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function eventCircuitBadgeVariant(id: string): BadgeVariant {
  return circuitBadgeVariant(id as CircuitLevel)
}

function eventCircuitDisplayLabel(id: string): string {
  return circuitDisplayLabel(id as CircuitLevel)
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

// ─── Sub-components ──────────────────────────────────────────────────────────

// SectionBlock — stamp label (1px rule above, 10px tracked uppercase, content below).
function SectionBlock({
  label,
  children,
  style,
}: {
  label: string
  children: ReactNode
  style?: React.CSSProperties
}): JSX.Element {
  return (
    <div
      style={{
        borderTop: 'var(--border-subtle)',
        paddingTop: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'rgba(218,212,201,0.35)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

// StatBlock — label above, value below. Used in the stat bar.
function StatBlock({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'rgba(218,212,201,0.55)',
          marginBottom: '3px',
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

// StatBar — full-bleed horizontal strip of stat blocks directly below the hero.
function StatBar({
  blocks,
}: {
  blocks: Array<{ label: string; value: string }>
}): JSX.Element {
  return (
    <div
      style={{
        marginLeft: 'calc(-1 * var(--space-6))',
        marginRight: 'calc(-1 * var(--space-6))',
        width: 'calc(100% + 2 * var(--space-6))',
        backgroundColor: 'var(--color-bg-mid)',
        display: 'flex',
        gap: 'var(--space-8)',
        padding: 'var(--space-3) var(--space-6)',
        marginBottom: 'var(--space-6)',
      }}
    >
      {blocks.map((b, i) => (
        <StatBlock key={i} label={b.label} value={b.value} />
      ))}
    </div>
  )
}

// VenueHero — full-bleed 21:9 image with gradient scrim.
// Venue name (Rock Bro), city · country, capacity pill overlaid on scrim.
function VenueHero({
  venueId,
  venueName,
  cityLine,
  capacity,
}: {
  venueId: string
  venueName: string
  cityLine: string
  capacity: string
}): JSX.Element {
  const [imgError, setImgError] = useState(false)
  const src = getVenueImageSrc(venueId)

  const bleed: React.CSSProperties = {
    marginLeft: 'calc(-1 * var(--space-6))',
    marginRight: 'calc(-1 * var(--space-6))',
    width: 'calc(100% + 2 * var(--space-6))',
    aspectRatio: '21 / 9',
    position: 'relative',
    overflow: 'hidden',
    marginTop: 'var(--space-2)',
  }

  const scrim: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 'var(--space-6)',
    paddingTop: '72px',
    background: 'linear-gradient(to top, var(--color-bg-dark) 0%, transparent 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
  }

  const overlay = (
    <div style={scrim}>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '28px',
          color: 'var(--color-text-primary)',
          lineHeight: 1.1,
        }}
      >
        {venueName}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
          {cityLine}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '10px',
            color: 'var(--color-text-primary)',
            border: '1px solid rgba(218,212,201,0.35)',
            padding: '2px 6px',
            flexShrink: 0,
            marginLeft: 'var(--space-4)',
          }}
        >
          {capacity}
        </span>
      </div>
    </div>
  )

  if (src === null || imgError) {
    return (
      <div
        style={{
          ...bleed,
          backgroundColor: '#0d0f13',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '11px',
            color: 'rgba(218,212,201,0.3)',
            textAlign: 'center',
          }}
        >
          {venueName}
        </span>
        {overlay}
      </div>
    )
  }

  return (
    <div style={bleed}>
      <img
        src={src}
        alt={venueName}
        onError={() => setImgError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
      />
      {overlay}
    </div>
  )
}

// EventListRow — compact single-row event entry for upcoming/past lists.
function EventListRow({ event, isLast }: { event: CalendarEvent; isLast: boolean }): JSX.Element {
  const sat     = isoWeekSaturday(event.year, event.week)
  const dateStr = sat.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) 0',
        borderBottom: isLast ? 'none' : 'var(--border-subtle)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '10px',
          color: 'rgba(218,212,201,0.4)',
          minWidth: '90px',
          flexShrink: 0,
        }}
      >
        {dateStr}
      </span>
      <Badge variant={eventCircuitBadgeVariant(event.circuitLevel)} label={eventCircuitDisplayLabel(event.circuitLevel)} />
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {event.label}
      </span>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function VenuePage(): JSX.Element {
  const gameData   = useGameStore(s => s.gameData)
  const worldState = useGameStore(s => s.worldState)
  const params     = useGameStore(s => s.navigationParams)
  const setScreen  = useGameStore(s => s.setScreen)

  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])

  const venueId = params?.venueId ?? ''

  useEffect(() => {
    if (worldState === null) return
    getAllEvents(worldState.saveId)
      .then(setAllEvents)
      .catch(() => setAllEvents([]))
  }, [worldState])

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

  const currentYear = worldState?.currentYear ?? 9999
  const currentWeek = worldState?.currentWeek  ?? 99

  const venueEvents    = allEvents.filter(e => e.venueId === venueId)
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
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Loading data…
        </p>
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

  const cityLine = `${venue.city.replace(/\b\w/g, c => c.toUpperCase())} · ${venue.country.replace(/\b\w/g, c => c.toUpperCase())}`

  return (
    <GameShell activeNav="calendar" onNavigate={handleNavigate}>
      {/* Back — text only, above the hero */}
      <button
        onClick={handleBack}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        ← Back
      </button>

      {/* Full-bleed hero: name, city, capacity */}
      <VenueHero
        venueId={venueId}
        venueName={venue.name}
        cityLine={cityLine}
        capacity={`${venue.capacity.toLocaleString()} seats`}
      />

      {/* Stat bar: CITY · COUNTRY · CAPACITY */}
      <StatBar
        blocks={[
          { label: 'City',     value: venue.city.replace(/\b\w/g, c => c.toUpperCase()) },
          { label: 'Country',  value: venue.country.replace(/\b\w/g, c => c.toUpperCase()) },
          { label: 'Capacity', value: `${venue.capacity.toLocaleString()} seats` },
        ]}
      />

      {/* Content — single column, max 900px */}
      <div style={{ maxWidth: '900px' }}>

        {/* ABOUT */}
        <SectionBlock label="About">
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            {venue.description}
            {venue.formerName !== undefined && (
              <span style={{ display: 'block', marginTop: 'var(--space-2)', color: 'rgba(218,212,201,0.4)', fontStyle: 'italic', fontSize: '11px' }}>
                Formerly known as {venue.formerName}.
              </span>
            )}
          </p>
        </SectionBlock>

        {/* HOSTS — eligibleFor circuit badges */}
        <SectionBlock label="Hosts">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {venue.eligibleFor.map(level => (
              <Badge key={level} variant={circuitBadgeVariant(level)} label={circuitDisplayLabel(level)} />
            ))}
          </div>
        </SectionBlock>

        {/* UPCOMING EVENTS — compact divider list */}
        <SectionBlock label="Upcoming Events">
          {upcomingEvents.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(218,212,201,0.35)', margin: 0 }}>
              No upcoming events scheduled.
            </p>
          ) : (
            upcomingEvents.map((event, i) => (
              <EventListRow key={event.id} event={event} isLast={i === upcomingEvents.length - 1} />
            ))
          )}
        </SectionBlock>

        {/* PAST EVENTS — compact divider list */}
        <SectionBlock label="Past Events">
          {pastEvents.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(218,212,201,0.35)', margin: 0 }}>
              No recorded events yet.
            </p>
          ) : (
            pastEvents.map((event, i) => (
              <EventListRow key={event.id} event={event} isLast={i === pastEvents.length - 1} />
            ))
          )}
        </SectionBlock>

      </div>
    </GameShell>
  )
}
