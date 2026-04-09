// EventFullPage — full detail view for a calendar event.
// Navigated to from the "View Full Details" button in the 75/25 quick view panel.
// Two-column header: text left, small venue image right (240px max). Images are texture.

import { useState, useEffect, type JSX, type ReactNode } from 'react'
import GameShell from '../components/layout/GameShell'
import Badge from '../components/Badge'
import Bracket from '../components/Bracket'
import { useGameStore } from '../store/gameStore'
import { getAllEvents } from '../ipc/client'

import type { CalendarEvent, CircuitLevel, Venue, EventTemplate, CircuitRules } from '@corner-gym/engine'
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

// deriveBracketRounds — how many elimination rounds does this circuit level have?
// Multi-day events: one round per day. Regional (single day): 3 rounds (8 fighters).
// Returns null for club_card — those use no bracket.
function deriveBracketRounds(level: CircuitLevel): number | null {
  if (level === 'club_card') return null
  const dayStructure = CIRCUIT_DAY_STRUCTURE[level]
  if (dayStructure !== undefined) return dayStructure.length
  // regional_tournament is a single-day 8-fighter tournament — 3 rounds.
  return 3
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

// ─── Sub-components ──────────────────────────────────────────────────────────

// SectionBlock — stamp label (1px rule above, 10px tracked uppercase label, content below).
// The foundation of the printed-document section pattern used across all three pages.
function SectionBlock({
  label,
  labelColor,
  children,
  style,
}: {
  label: string
  labelColor?: string
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
          color: labelColor ?? 'rgba(218,212,201,0.35)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

// StatBlock — label above, value below. Used in stat grid and rules row.
function StatBlock({
  label,
  value,
  onClick,
}: {
  label: string
  value: string
  onClick?: () => void
}): JSX.Element {
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
      {onClick !== undefined ? (
        <button
          onClick={onClick}
          onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
          onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--color-text-primary)',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          {value}
        </button>
      ) : (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-text-primary)' }}>
          {value}
        </div>
      )}
    </div>
  )
}

// EventHeader — two-column header: text left, small venue image right.
// Image is texture (240px max, 4:3), not a hero. Text dominates.
function EventHeader({
  venueId,
  venueName,
  eventLabel,
  circuitLevel,
  dateStr,
  onVenueClick,
}: {
  venueId: string
  venueName: string
  eventLabel: string
  circuitLevel: CircuitLevel
  dateStr: string
  onVenueClick: () => void
}): JSX.Element {
  const [imgError, setImgError] = useState(false)
  const src = getVenueImageSrc(venueId)
  const showImage = src !== null && !imgError

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-6)',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-4)',
      }}
    >
      {/* Left column — all text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Circuit badge + date on same line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <Badge variant={circuitBadgeVariant(circuitLevel)} label={circuitLabel(circuitLevel)} />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              color: 'rgba(218,212,201,0.5)',
            }}
          >
            {dateStr}
          </span>
        </div>

        {/* Event name */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            color: 'var(--color-text-primary)',
            margin: '0 0 var(--space-2)',
            lineHeight: 1.1,
          }}
        >
          {eventLabel}
        </h1>

        {/* Venue link */}
        <button
          onClick={onVenueClick}
          onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
          onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          {venueName}
        </button>
      </div>

      {/* Right column — small venue image, 240px max, 4:3, if it exists */}
      {showImage && (
        <div
          style={{
            width: '240px',
            flexShrink: 0,
            aspectRatio: '4 / 3',
            overflow: 'hidden',
          }}
        >
          <img
            src={src}
            alt={venueName}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function EventFullPage(): JSX.Element {
  const gameData   = useGameStore(s => s.gameData)
  const worldState = useGameStore(s => s.worldState)
  const params     = useGameStore(s => s.navigationParams)
  const setScreen  = useGameStore(s => s.setScreen)

  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])

  const event = params?.calendarEvent ?? null

  useEffect(() => {
    if (worldState === null) return
    getAllEvents(worldState.saveId)
      .then(setAllEvents)
      .catch(() => setAllEvents([]))
  }, [worldState])

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

  const isOlympics  = event.circuitLevel === 'olympics'
  const dayStructure = CIRCUIT_DAY_STRUCTURE[event.circuitLevel]
  const isMultiDay  = dayStructure !== undefined
  const totalDays   = dayStructure?.length ?? 1

  const firstDay = isMultiDay
    ? eventDayDate(event.year, event.week, 1, totalDays)
    : isoWeekSaturday(event.year, event.week)
  const lastDay = isMultiDay
    ? eventDayDate(event.year, event.week, totalDays, totalDays)
    : firstDay
  const dateStr = isMultiDay
    ? `${firstDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${lastDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : firstDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  // Venue lookup across all nation bundles then international.
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

  // Event template description lookup.
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

  // Sanctioning body lookup via circuit definition.
  let sanctioningBodyLabel = ''
  let sanctioningBodyId    = ''
  for (const bundle of Object.values(gameData.nations)) {
    if (bundle.boxing !== undefined) {
      for (const circuit of bundle.boxing.amateurCircuit.circuitLevels) {
        if (circuit.id === event.circuitLevel) {
          const body = bundle.boxing.sanctioningBodies.sanctioningBodies.find(b => b.id === circuit.sanctioningBody)
          if (body !== undefined) {
            sanctioningBodyLabel = body.label
            sanctioningBodyId    = body.id
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
          sanctioningBodyId    = body.id
        }
        break
      }
    }
  }

  // Senior rule object — used for the three-block RULES section.
  let seniorRule: CircuitRules | undefined
  const findRule = (rules: import('@corner-gym/engine').RulesData): void => {
    const r = rules.circuitRules.find(cr => cr.circuitLevel === event.circuitLevel && cr.ageCategory === 'senior')
    if (r !== undefined) seniorRule = r
  }
  for (const bundle of Object.values(gameData.nations)) {
    if (bundle.boxing?.rules !== undefined) findRule(bundle.boxing.rules)
  }
  if (seniorRule === undefined) findRule(gameData.international.boxing.eubcRules)
  if (seniorRule === undefined) findRule(gameData.international.boxing.ibaRules)

  const pastEditions = allEvents.filter(
    e => e.templateId === event.templateId && e.status === 'completed' && e.id !== event.id,
  )

  const formatStr = event.circuitLevel === 'club_card'
    ? 'Card · One bout per fighter'
    : isMultiDay
      ? `Tournament · Single Elimination · ${totalDays} Day Event`
      : 'Single Day Tournament · Single Elimination'

  const venueName  = event.venueName !== '' ? event.venueName : event.venueId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const cityDisplay = venue !== undefined
    ? `${venue.city.replace(/\b\w/g, c => c.toUpperCase())}, ${venue.country.replace(/\b\w/g, c => c.toUpperCase())}`
    : ''

  return (
    <GameShell activeNav="calendar" onNavigate={handleNavigate}>
      {/* Two-column header: text left, small venue image right */}
      <EventHeader
        venueId={event.venueId}
        venueName={venueName}
        eventLabel={event.label}
        circuitLevel={event.circuitLevel}
        dateStr={dateStr}
        onVenueClick={() => setScreen('venue', { venueId: event.venueId })}
      />

      {/* Stat row: VENUE · CITY · CAPACITY */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-8)',
          paddingBottom: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
          borderBottom: 'var(--border-subtle)',
        }}
      >
        <StatBlock
          label="Venue"
          value={venueName}
          onClick={() => setScreen('venue', { venueId: event.venueId })}
        />
        {cityDisplay !== '' && <StatBlock label="City" value={cityDisplay} />}
        {venue !== undefined && (
          <StatBlock label="Capacity" value={`${venue.capacity.toLocaleString()} seats`} />
        )}
      </div>

      {/* Content — single column, max 900px */}
      <div style={{ maxWidth: '900px' }}>

        {/* ABOUT */}
        {template !== undefined && (
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
              {template.description}
            </p>
          </SectionBlock>
        )}

        {/* FORMAT */}
        <SectionBlock label="Format">
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
            {formatStr}
            {event.circuitLevel === 'club_card' ? ' · Results same night' : ''}
          </p>
        </SectionBlock>

        {/* RULES — three stat blocks: Rounds / Duration / Scoring */}
        {seniorRule !== undefined && (
          <SectionBlock label="Rules">
            <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
              <StatBlock label="Rounds"   value={String(seniorRule.rounds)} />
              <StatBlock label="Duration" value={`${seniorRule.roundDurationMinutes} min each`} />
              <StatBlock label="Scoring"  value={seniorRule.scoringSystem.replace(/_/g, ' ')} />
            </div>
          </SectionBlock>
        )}

        {/* SANCTIONED BY */}
        {sanctioningBodyId !== '' && (
          <SectionBlock label="Sanctioned By">
            <button
              onClick={() => setScreen('sanctioningBody', { bodyId: sanctioningBodyId })}
              onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
              onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--color-text-primary)',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              {sanctioningBodyLabel}
            </button>
          </SectionBlock>
        )}

        {/* COMPETITION SCHEDULE — multi-day events only */}
        {isMultiDay && dayStructure !== undefined && (
          <SectionBlock label="Competition Schedule">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {dayStructure.map((ds, i) => {
                const dayDate   = eventDayDate(event.year, event.week, i + 1, totalDays)
                const dayOfWeek = dayDate.toLocaleDateString('en-GB', { weekday: 'long' })
                const dayMonth  = dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 'var(--space-4)',
                      padding: 'var(--space-2) 0',
                      borderBottom: i < dayStructure.length - 1 ? 'var(--border-subtle)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '10px',
                        color: 'rgba(218,212,201,0.4)',
                        minWidth: '36px',
                        flexShrink: 0,
                      }}
                    >
                      Day {i + 1}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '11px',
                        color: 'rgba(218,212,201,0.5)',
                        minWidth: '180px',
                        flexShrink: 0,
                      }}
                    >
                      {dayOfWeek}, {dayMonth}
                    </span>
                    <span
                      style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-text-primary)' }}
                    >
                      {ds.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </SectionBlock>
        )}

        {/* BRACKET — real bracket for tournaments, text fallback for club cards */}
        {(() => {
          const bracketRounds = deriveBracketRounds(event.circuitLevel)
          if (bracketRounds === null) {
            return (
              <SectionBlock label="Bracket">
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(218,212,201,0.45)', margin: 0 }}>
                  No bracket — fighters matched on the night.
                </p>
              </SectionBlock>
            )
          }
          return (
            <SectionBlock label="Tournament Bracket">
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <Bracket rounds={bracketRounds} entrants={[]} />
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(218,212,201,0.35)', margin: 0 }}>
                Entry opens when the event is scheduled · Bracket drawn when entry closes.
              </p>
            </SectionBlock>
          )
        })()}

        {/* WHY THIS EVENT MATTERS — Olympics: gold left border, gold label, larger text */}
        {isOlympics ? (
          <div
            style={{
              borderLeft: '3px solid var(--color-accent-gold)',
              paddingLeft: 'var(--space-4)',
              paddingTop: 'var(--space-4)',
              marginBottom: 'var(--space-6)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--color-accent-gold)',
                marginBottom: 'var(--space-2)',
              }}
            >
              Why This Event Matters
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--color-accent-gold)',
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              {WHY_IT_MATTERS[event.circuitLevel]}
            </p>
          </div>
        ) : (
          <SectionBlock label="Why This Event Matters">
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--color-text-muted)',
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              {WHY_IT_MATTERS[event.circuitLevel]}
            </p>
          </SectionBlock>
        )}

        {/* PAST EDITIONS — compact list or single muted line */}
        <SectionBlock label="Past Editions">
          {pastEditions.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(218,212,201,0.35)', margin: 0 }}>
              No previous editions recorded.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {pastEditions.map((e, i) => {
                const sat = isoWeekSaturday(e.year, e.week)
                const city = e.cityId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                const vn   = e.venueName !== '' ? e.venueName : e.venueId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                return (
                  <div
                    key={e.id}
                    style={{
                      padding: 'var(--space-2) 0',
                      borderBottom: i < pastEditions.length - 1 ? 'var(--border-subtle)' : 'none',
                      fontFamily: 'var(--font-body)',
                      fontSize: '11px',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <span style={{ color: 'rgba(218,212,201,0.55)' }}>{sat.getFullYear()}</span>
                    <span style={{ color: 'rgba(218,212,201,0.25)', margin: '0 var(--space-1)' }}> · </span>
                    <span>{city}</span>
                    <span style={{ color: 'rgba(218,212,201,0.25)', margin: '0 var(--space-1)' }}> · </span>
                    <span>{vn}</span>
                  </div>
                )
              })}
            </div>
          )}
        </SectionBlock>

      </div>
    </GameShell>
  )
}
