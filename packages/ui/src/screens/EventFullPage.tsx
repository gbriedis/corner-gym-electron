// EventFullPage — full detail view for a calendar event.
// Navigated to from the "View Full Details" button in the 75/25 quick view panel.
// Styled as a worn boxing programme: full-bleed hero, stamp labels, no web-UI cards.

import { useState, useEffect, type JSX, type ReactNode } from 'react'
import GameShell from '../components/layout/GameShell'
import Badge from '../components/Badge'
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

// StatBlock — label above, value below. Used in stat bar (large) and rules row (small).
function StatBlock({
  label,
  value,
  size = 'large',
  onClick,
}: {
  label: string
  value: string
  size?: 'large' | 'small'
  onClick?: () => void
}): JSX.Element {
  const valueSize = size === 'large' ? '13px' : '12px'
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'rgba(218,212,201,0.55)',
    marginBottom: '3px',
  }
  const valueStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: valueSize,
    color: 'var(--color-text-primary)',
  }
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      {onClick !== undefined ? (
        <button
          onClick={onClick}
          onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
          onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
          style={{ ...valueStyle, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'none' }}
        >
          {value}
        </button>
      ) : (
        <div style={valueStyle}>{value}</div>
      )}
    </div>
  )
}

// StatBar — full-bleed horizontal strip of stat blocks directly below the hero.
function StatBar({
  blocks,
}: {
  blocks: Array<{ label: string; value: string; onClick?: () => void }>
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
        <StatBlock
          key={i}
          label={b.label}
          value={b.value}
          size="large"
          {...(b.onClick !== undefined ? { onClick: b.onClick } : {})}
        />
      ))}
    </div>
  )
}

// EventHero — full-bleed 21:9 image with gradient scrim.
// Event name (Rock Bro), circuit badge + format, date overlaid on scrim.
function EventHero({
  venueId,
  venueName,
  eventLabel,
  circuitLevel,
  formatStr,
  dateStr,
}: {
  venueId: string
  venueName: string
  eventLabel: string
  circuitLevel: CircuitLevel
  formatStr: string
  dateStr: string
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
    gap: 'var(--space-2)',
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
        {eventLabel}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Badge variant={circuitBadgeVariant(circuitLevel)} label={circuitLabel(circuitLevel)} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.55)' }}>
            {formatStr}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '10px',
            color: 'var(--color-text-muted)',
            flexShrink: 0,
            marginLeft: 'var(--space-4)',
          }}
        >
          {dateStr}
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

// ─── Main Component ─────────────────────────────────────────────────────────

export default function EventFullPage(): JSX.Element {
  const gameData   = useGameStore(s => s.gameData)
  const worldState = useGameStore(s => s.worldState)
  const params     = useGameStore(s => s.navigationParams)
  const setScreen  = useGameStore(s => s.setScreen)

  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])

  const event       = params?.calendarEvent ?? null
  const returnMonth = params?.returnMonth
  const returnYear  = params?.returnYear

  useEffect(() => {
    if (worldState === null) return
    getAllEvents(worldState.saveId)
      .then(setAllEvents)
      .catch(() => setAllEvents([]))
  }, [worldState])

  function handleBack(): void {
    setScreen(
      'calendar',
      returnMonth !== undefined && returnYear !== undefined
        ? { returnMonth, returnYear }
        : undefined,
    )
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
      {/* Back — text only, above the image */}
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

      {/* Full-bleed hero image with gradient scrim */}
      <EventHero
        venueId={event.venueId}
        venueName={venueName}
        eventLabel={event.label}
        circuitLevel={event.circuitLevel}
        formatStr={formatStr}
        dateStr={dateStr}
      />

      {/* Stat bar: VENUE · CITY · CAPACITY · DATE */}
      <StatBar
        blocks={[
          {
            label: 'Venue',
            value: venueName,
            onClick: () => setScreen('venue', { venueId: event.venueId }),
          },
          ...(cityDisplay !== '' ? [{ label: 'City', value: cityDisplay }] : []),
          ...(venue !== undefined
            ? [{ label: 'Capacity', value: `${venue.capacity.toLocaleString()} seats` }]
            : []),
          { label: 'Date', value: dateStr },
        ]}
      />

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
              <StatBlock label="Rounds"   value={String(seniorRule.rounds)}                                    size="small" />
              <StatBlock label="Duration" value={`${seniorRule.roundDurationMinutes} min each`}                size="small" />
              <StatBlock label="Scoring"  value={seniorRule.scoringSystem.replace(/_/g, ' ')}                 size="small" />
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

        {/* TOURNAMENT BRACKET — dark inset placeholder */}
        <SectionBlock label="Tournament Bracket">
          <div
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--color-bg-mid)',
              padding: 'var(--space-4)',
              textAlign: 'center',
            }}
          >
            {event.status === 'scheduled' ? (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    marginBottom: 'var(--space-2)',
                  }}
                >
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
        </SectionBlock>

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
