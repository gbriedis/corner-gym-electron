// EventFullPage — full detail view for a calendar event.
// Navigated to from the "View Full Details" button in the 75/25 quick view panel.
// Shows venue image, competition schedule, bracket placeholder, history, why it matters.

import { useState, useEffect, type JSX } from 'react'
import { ArrowLeftIcon, SewingPinIcon } from '@radix-ui/react-icons'
import GameShell from '../components/layout/GameShell'
import Badge from '../components/Badge'
import { useGameStore } from '../store/gameStore'
import { getAllEvents } from '../ipc/client'

import type { CalendarEvent, CircuitLevel, Venue, EventTemplate } from '@corner-gym/engine'
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

function circuitLabel(level: CircuitLevel): string {
  switch (level) {
    case 'club_card':             return 'Club Card'
    case 'regional_tournament':   return 'Regional Tournament'
    case 'national_championship': return 'National Championship'
    case 'baltic_championship':   return 'Baltic Championship'
    case 'european_championship': return 'European Championship'
    case 'world_championship':    return 'World Championship'
    case 'olympics':              return 'Olympics'
  }
}

function circuitBadgeVariant(level: CircuitLevel): BadgeVariant {
  switch (level) {
    case 'club_card':             return 'neutral'
    case 'regional_tournament':   return 'normal'
    case 'national_championship': return 'hard'
    case 'baltic_championship':   return 'easy'
    case 'european_championship': return 'normal'
    case 'world_championship':    return 'hard'
    case 'olympics':              return 'hard'
  }
}

function circuitAccentColor(level: CircuitLevel): string {
  switch (level) {
    case 'club_card':             return 'var(--color-text-muted)'
    case 'regional_tournament':   return 'var(--color-accent-blue)'
    case 'national_championship': return 'var(--color-accent-amber)'
    case 'baltic_championship':   return 'var(--color-accent-green)'
    case 'european_championship': return 'var(--color-accent-blue-dark)'
    case 'world_championship':    return 'var(--color-accent-gold)'
    case 'olympics':              return 'var(--color-accent-gold)'
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

// eventDayDate — same logic as Calendar.tsx, duplicated here to avoid import coupling.
function eventDayDate(year: number, week: number, dayNum: number, totalDays: number): Date {
  const jan4 = new Date(year, 0, 4)
  const dow = (jan4.getDay() + 6) % 7
  const week1Mon = new Date(jan4)
  week1Mon.setDate(jan4.getDate() - dow)
  const weekMon = new Date(week1Mon)
  weekMon.setDate(week1Mon.getDate() + (week - 1) * 7)
  const sun = new Date(weekMon)
  sun.setDate(weekMon.getDate() + 6)
  const result = new Date(sun)
  result.setDate(sun.getDate() - (totalDays - dayNum))
  return result
}

// CIRCUIT_DAY_STRUCTURE mirrors Calendar.tsx — multi-day circuit schedules.
const CIRCUIT_DAY_STRUCTURE: Partial<Record<CircuitLevel, Array<{ label: string }>>> = {
  national_championship: [
    { label: 'Quarterfinals' },
    { label: 'Semifinals' },
    { label: 'Finals' },
  ],
  baltic_championship: [
    { label: 'Quarterfinals' },
    { label: 'Semifinals' },
    { label: 'Finals' },
  ],
  european_championship: [
    { label: 'Round of 16' },
    { label: 'Quarterfinals' },
    { label: 'Semifinals' },
    { label: 'Finals' },
  ],
  world_championship: [
    { label: 'Round of 16' },
    { label: 'Quarterfinals' },
    { label: 'Semifinals' },
    { label: 'Finals' },
  ],
  olympics: [
    { label: 'Round of 16' },
    { label: 'Quarterfinals' },
    { label: 'Semifinals' },
    { label: 'Finals' },
  ],
}

// WHY_IT_MATTERS explains the significance of each circuit level.
const WHY_IT_MATTERS: Record<CircuitLevel, string> = {
  club_card: 'A local card. One bout, go home. The starting point.',
  regional_tournament: 'First real tournament experience. Fighters advance through a bracket in a single day.',
  national_championship: 'The Latvian title. The ceiling of domestic amateur boxing and the gateway to international selection.',
  baltic_championship: 'Latvia, Lithuania, Estonia. Regional prestige.',
  european_championship: 'The highest level most Latvian fighters will ever compete at.',
  world_championship: 'World amateur title. Reached by very few.',
  olympics: 'Every four years. The pinnacle. Selection via federation qualification. This is what everything points toward.',
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

// VenueImage — consistent with VenuePage.tsx
function VenueImage({ venueId, venueName }: { venueId: string; venueName: string }): JSX.Element {
  const [imgError, setImgError] = useState(false)
  const src = getVenueImageSrc(venueId)

  const containerStyle: React.CSSProperties = {
    width: '100%',
    aspectRatio: '21 / 9',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    marginBottom: 'var(--space-3)',
  }

  if (src === null || imgError) {
    return (
      <div
        style={{
          ...containerStyle,
          backgroundColor: '#0d0f13',
          border: 'var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
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
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function EventFullPage(): JSX.Element {
  const gameData    = useGameStore(s => s.gameData)
  const worldState  = useGameStore(s => s.worldState)
  const params      = useGameStore(s => s.navigationParams)
  const setScreen   = useGameStore(s => s.setScreen)

  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])

  const event = params?.calendarEvent ?? null
  const returnMonth = params?.returnMonth
  const returnYear  = params?.returnYear

  useEffect(() => {
    if (worldState === null) return
    getAllEvents(worldState.saveId)
      .then(setAllEvents)
      .catch(() => setAllEvents([]))
  }, [worldState])

  function handleBack(): void {
    setScreen('calendar', returnMonth !== undefined && returnYear !== undefined
      ? { returnMonth, returnYear }
      : undefined)
  }

  function handleNavigate(id: string): void {
    if (id !== 'calendar') setScreen('game')
    else setScreen('calendar')
  }

  if (event === null || gameData === null) {
    return (
      <GameShell activeNav="calendar" onNavigate={handleNavigate}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Loading…
        </p>
      </GameShell>
    )
  }

  const isOlympics = event.circuitLevel === 'olympics'
  const accentColor = circuitAccentColor(event.circuitLevel)
  const dayStructure = CIRCUIT_DAY_STRUCTURE[event.circuitLevel]
  const isMultiDay = dayStructure !== undefined
  const totalDays = dayStructure?.length ?? 1

  // Date string — start of event for multi-day, or the single day
  const firstDay = isMultiDay
    ? eventDayDate(event.year, event.week, 1, totalDays)
    : isoWeekSaturday(event.year, event.week)
  const lastDay = isMultiDay
    ? eventDayDate(event.year, event.week, totalDays, totalDays)
    : firstDay
  const dateStr = isMultiDay
    ? `${firstDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${lastDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : firstDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  // Find venue data
  let venue: Venue | undefined
  for (const bundle of Object.values(gameData.nations)) {
    if (bundle.boxing !== undefined) {
      const found = bundle.boxing.venues.venues.find(v => v.id === event.venueId)
      if (found !== undefined) { venue = found; break }
    }
  }
  if (venue === undefined) {
    venue = gameData.international.boxing.venues.venues.find(v => v.id === event.venueId)
  }

  // Find event template description
  let template: EventTemplate | undefined
  for (const bundle of Object.values(gameData.nations)) {
    if (bundle.boxing !== undefined) {
      const found = bundle.boxing.eventTemplates.eventTemplates.find(t => t.id === event.templateId)
      if (found !== undefined) { template = found; break }
    }
  }
  if (template === undefined) {
    template = gameData.international.boxing.eventTemplates.eventTemplates.find(t => t.id === event.templateId)
  }

  // Find sanctioning body
  let sanctioningBodyLabel = ''
  let sanctioningBodyId = ''
  for (const bundle of Object.values(gameData.nations)) {
    if (bundle.boxing !== undefined) {
      for (const circuit of bundle.boxing.amateurCircuit.circuitLevels) {
        if (circuit.id === event.circuitLevel) {
          const body = bundle.boxing.sanctioningBodies.sanctioningBodies.find(b => b.id === circuit.sanctioningBody)
          if (body !== undefined) {
            sanctioningBodyLabel = body.label
            sanctioningBodyId = body.id
          }
          break
        }
      }
    }
  }
  if (sanctioningBodyId === '') {
    for (const circuit of gameData.international.boxing.circuits.circuitLevels) {
      if (circuit.id === event.circuitLevel) {
        const body = gameData.international.boxing.sanctioningBodies.sanctioningBodies.find(b => b.id === circuit.sanctioningBody)
        if (body !== undefined) {
          sanctioningBodyLabel = body.label
          sanctioningBodyId = body.id
        }
        break
      }
    }
  }

  // Find circuit rules (senior category)
  let seniorRulesText = ''
  const findRules = (rules: import('@corner-gym/engine').RulesData): void => {
    const rule = rules.circuitRules.find(r => r.circuitLevel === event.circuitLevel && r.ageCategory === 'senior')
    if (rule !== undefined) {
      seniorRulesText = `${rule.rounds} rounds × ${rule.roundDurationMinutes} min · ${rule.scoringSystem.replace(/_/g, ' ')}`
    }
  }
  for (const bundle of Object.values(gameData.nations)) {
    if (bundle.boxing?.rules !== undefined) findRules(bundle.boxing.rules)
  }
  if (seniorRulesText === '') findRules(gameData.international.boxing.eubcRules)
  if (seniorRulesText === '') findRules(gameData.international.boxing.ibaRules)

  // Past editions of this event (same templateId, completed status)
  const pastEditions = allEvents.filter(e => e.templateId === event.templateId && e.status === 'completed' && e.id !== event.id)

  // Format indicator string
  const formatStr = event.circuitLevel === 'club_card'
    ? 'Card · One bout per fighter'
    : isMultiDay
      ? `Tournament · Single Elimination · ${totalDays} Days`
      : 'Single Day Tournament · Single Elimination'

  const venueName = event.venueName !== '' ? event.venueName : event.venueId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <GameShell activeNav="calendar" onNavigate={handleNavigate}>
      {/* Back */}
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

      {/* Event header */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h1
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: isOlympics ? '22px' : '18px',
            fontWeight: 700,
            color: accentColor,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            margin: '0 0 var(--space-2)',
          }}
        >
          {event.label}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
          <Badge variant={circuitBadgeVariant(event.circuitLevel)} label={circuitLabel(event.circuitLevel)} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.4)' }}>
            {formatStr}
          </span>
          <span style={{ color: 'rgba(218,212,201,0.2)', fontSize: '10px' }}>·</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.4)' }}>
            {dateStr}
          </span>
        </div>
        {/* Venue link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <SewingPinIcon width={10} height={10} style={{ color: 'var(--color-text-muted)' }} />
          <button
            onClick={() => setScreen('venue', { venueId: event.venueId })}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              color: 'var(--color-text-primary)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none' }}
          >
            {venueName}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start', maxWidth: '1000px' }}>
        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Venue feature */}
          <VenueImage venueId={event.venueId} venueName={venueName} />
          {venue !== undefined && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {venue.name}
                </span>
                <span style={{ color: 'rgba(218,212,201,0.2)', fontSize: '10px' }}>·</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {venue.city.replace(/\b\w/g, c => c.toUpperCase())}, {venue.country.replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                <span style={{ color: 'rgba(218,212,201,0.2)', fontSize: '10px' }}>·</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(218,212,201,0.5)' }}>
                  {venue.capacity.toLocaleString()} seats
                </span>
                <button
                  onClick={() => setScreen('venue', { venueId: event.venueId })}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '10px',
                    color: 'var(--color-accent-blue)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none' }}
                >
                  View venue →
                </button>
              </div>
            </div>
          )}

          {/* About this event */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <SectionLabel label="About This Event" />
            {template !== undefined && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 'var(--space-3)' }}>
                {template.description}
              </p>
            )}
            {seniorRulesText !== '' && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'rgba(218,212,201,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Senior rules
                </span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {seniorRulesText}
                </span>
              </div>
            )}
            {sanctioningBodyId !== '' && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'rgba(218,212,201,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Sanctioned by
                </span>
                <button
                  onClick={() => setScreen('sanctioningBody', { bodyId: sanctioningBodyId })}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    color: 'var(--color-text-primary)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none' }}
                >
                  {sanctioningBodyLabel}
                </button>
              </div>
            )}
          </div>

          {/* Multi-day competition schedule */}
          {isMultiDay && dayStructure !== undefined && (
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <SectionLabel label="Competition Schedule" />
              <div style={{ borderLeft: `2px solid ${accentColor}`, paddingLeft: 'var(--space-3)' }}>
                {dayStructure.map((ds, i) => {
                  const dayDate = eventDayDate(event.year, event.week, i + 1, totalDays)
                  const dayOfWeek = dayDate.toLocaleDateString('en-GB', { weekday: 'long' })
                  const dayMonth = dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-2) 0',
                        borderBottom: i < dayStructure.length - 1 ? '1px solid rgba(218,212,201,0.05)' : 'none',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.4)', minWidth: '44px', flexShrink: 0 }}>
                        Day {i + 1}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', minWidth: '200px', flexShrink: 0 }}>
                        {dayOfWeek}, {dayMonth}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                        {ds.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Bracket placeholder */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <SectionLabel label="Tournament Bracket" />
            <div
              style={{
                background: 'rgba(218,212,201,0.03)',
                border: 'var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                textAlign: 'center',
              }}
            >
              {event.status === 'scheduled' ? (
                <>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                    Bracket will be drawn when entry closes.
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.35)' }}>
                    Enter a fighter via the Fighters screen once your roster is set up.
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  Bracket structure coming soon.
                </div>
              )}
            </div>
          </div>

          {/* Why this event matters */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <SectionLabel label="Why This Event Matters" />
            <div
              style={{
                background: isOlympics ? 'rgba(255,209,131,0.06)' : 'rgba(218,212,201,0.03)',
                border: isOlympics ? '1px solid rgba(255,209,131,0.15)' : 'var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: isOlympics ? '14px' : '12px',
                  color: isOlympics ? 'var(--color-accent-gold)' : 'var(--color-text-muted)',
                  fontWeight: isOlympics ? 600 : 400,
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {WHY_IT_MATTERS[event.circuitLevel]}
              </p>
            </div>
          </div>
        </div>

        {/* Right sidebar — past editions */}
        <div style={{ width: '260px', flexShrink: 0 }}>
          <div
            style={{
              background: 'rgba(10,10,14,0.4)',
              border: 'var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: 'var(--border-subtle)' }}>
              <SectionLabel label="Past Editions" />
            </div>
            <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
              {pastEditions.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.35)', margin: 0, fontStyle: 'italic' }}>
                  No previous editions recorded — fills as the game progresses.
                </p>
              ) : (
                pastEditions.map(e => {
                  const sat = isoWeekSaturday(e.year, e.week)
                  const city = e.countryDisplay !== undefined
                    ? e.cityId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    : e.cityId.replace(/^[^-]+-/, '').replace(/\b\w/g, c => c.toUpperCase())
                  return (
                    <div
                      key={e.id}
                      style={{
                        padding: 'var(--space-2) 0',
                        borderBottom: '1px solid rgba(218,212,201,0.05)',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {sat.getFullYear()}
                      </div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.4)' }}>
                        {city} · {e.venueName !== '' ? e.venueName : e.venueId}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </GameShell>
  )
}
