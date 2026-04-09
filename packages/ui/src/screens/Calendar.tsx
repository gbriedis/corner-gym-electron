// Calendar screen — month grid view of the full boxing calendar.
// Events are placed on the Saturday of their ISO week (the traditional fight-night day).
// Clicking a day cell opens a detail panel on the right.
// Navigate with ← → arrows, keyboard arrow keys, or the Today button.

import { useState, useEffect, useCallback, type JSX } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SewingPinIcon,
  PersonIcon,
  Cross2Icon,
} from '@radix-ui/react-icons'
import GameShell from '../components/layout/GameShell'
import Badge from '../components/Badge'
import { useGameStore } from '../store/gameStore'
import { getAllEvents } from '../ipc/client'

import type { CalendarEvent, GameData } from '@corner-gym/engine'
import type { BadgeVariant } from '../components/Badge'

// circuitCellBgColor — tint colour for each circuit level in day cell sections.
// Applied as the background of each event's split section within the cell.
function circuitCellBgColor(level: CalendarEvent['circuitLevel']): string {
  switch (level) {
    case 'club_card':             return 'rgba(218,212,201,0.06)'
    case 'regional_tournament':   return 'rgba(90,139,222,0.2)'
    case 'national_championship': return 'rgba(238,178,74,0.2)'
    case 'baltic_championship':   return 'rgba(85,146,127,0.2)'
    case 'european_championship': return 'rgba(33,82,165,0.2)'
    case 'world_championship':    return 'rgba(255,209,131,0.2)'
    case 'olympics':              return 'rgba(255,209,131,0.25)'
  }
}

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

// Weight classes in descending weight order (super_heavyweight first, flyweight last).
// Used for consistent heavy-to-light display in weight class lists and entry slots.
const WEIGHT_CLASS_DISPLAY_ORDER = [
  'super_heavyweight', 'heavyweight', 'cruiserweight', 'light_heavyweight',
  'middleweight', 'welterweight', 'lightweight', 'featherweight', 'bantamweight', 'flyweight',
]

function sortWeightClassesHeavyFirst(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const ai = WEIGHT_CLASS_DISPLAY_ORDER.indexOf(a)
    const bi = WEIGHT_CLASS_DISPLAY_ORDER.indexOf(b)
    // Unknown ids go last
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
}

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

// CIRCUIT_DAY_STRUCTURE maps each multi-day circuit level to its day schedule.
// Finals are always on Sunday; earlier days count back from there.
// Single-day circuits (club_card, regional_tournament) are absent from this map.
const CIRCUIT_DAY_STRUCTURE: Partial<Record<CalendarEvent['circuitLevel'], Array<{ label: string }>>> = {
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


// eventDayDate returns the actual Date for day `dayNum` (1-indexed) of a multi-day event.
// Multi-day events end on Sunday of their ISO week — day N counts back from that Sunday.
// A 3-day event: day 1 = Friday, day 2 = Saturday, day 3 = Sunday.
// A 4-day event: day 1 = Thursday, day 2 = Friday, day 3 = Saturday, day 4 = Sunday.
// Anchoring on Sunday ensures the finals are always the last day of a calendar row.
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

// getEventDaysOnDate returns all events (with their day index in the event) that
// have at least one day falling on the given calendar date.
// For single-day events: only present when their Saturday matches.
// For multi-day events: present for each day that falls on this date.
function getEventDaysOnDate(
  events: CalendarEvent[],
  year: number,
  month: number,
  day: number,
): Array<{ event: CalendarEvent; dayIndex: number; totalDays: number }> {
  const result: Array<{ event: CalendarEvent; dayIndex: number; totalDays: number }> = []
  for (const event of events) {
    const dayStructure = CIRCUIT_DAY_STRUCTURE[event.circuitLevel]
    if (dayStructure === undefined) {
      const sat = isoWeekSaturday(event.year, event.week)
      if (sat.getFullYear() === year && sat.getMonth() + 1 === month && sat.getDate() === day) {
        result.push({ event, dayIndex: 0, totalDays: 1 })
      }
    } else {
      for (let i = 0; i < dayStructure.length; i++) {
        const d = eventDayDate(event.year, event.week, i + 1, dayStructure.length)
        if (d.getFullYear() === year && d.getMonth() + 1 === month && d.getDate() === day) {
          result.push({ event, dayIndex: i, totalDays: dayStructure.length })
        }
      }
    }
  }
  return result
}

// circuitBadgeVariant maps a circuit level to a Badge variant for prestige display.
function circuitBadgeVariant(level: CalendarEvent['circuitLevel']): BadgeVariant {
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

function circuitLabel(level: CalendarEvent['circuitLevel']): string {
  switch (level) {
    case 'club_card':             return 'Club Card'
    case 'regional_tournament':   return 'Regional'
    case 'national_championship': return 'Nationals'
    case 'baltic_championship':   return 'Baltic'
    case 'european_championship': return 'European'
    case 'world_championship':    return 'Worlds'
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
    case 'club_card':
    case 'regional_tournament':
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

// governingBodyId returns the sanctioning body id for navigation to body page.
function governingBodyId(level: CalendarEvent['circuitLevel']): string {
  switch (level) {
    case 'club_card':
    case 'regional_tournament':
    case 'national_championship':
      return 'lbf'
    case 'baltic_championship':
    case 'european_championship':
      return 'eubc'
    case 'world_championship':
    case 'olympics':
      return 'iba'
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

  // 16:9 aspect ratio enforced on the container — objectFit cover then center-crops
  // whatever the source dimensions are. Fixed height alone on a square image would
  // show the full square; aspect ratio gives the expected widescreen crop.
  const containerStyle: React.CSSProperties = {
    width: '100%',
    aspectRatio: isOlympics ? '21 / 9' : '16 / 9',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    position: 'relative',
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
    <div style={containerStyle}>
      <img
        src={src}
        alt={venueName}
        onError={() => setImgError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block',
        }}
      />
    </div>
  )
}

// circuitAccentColor returns the primary display color for a circuit level.
// Used for panel headers, borders, and day-schedule accents.
function circuitAccentColor(level: CalendarEvent['circuitLevel']): string {
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

// HoverLink renders text that underlines on hover — used for sanctioning body + venue links.
function HoverLink({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: '11px',
        color: 'var(--color-text-primary)',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        textDecoration: hovered ? 'underline' : 'none',
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  )
}

// EventDetailPanel renders the right-side panel when an event is selected.
function EventDetailPanel({ event, onClose, onViewFull, onBodyClick, onVenueClick }: {
  event: CalendarEvent
  onClose: () => void
  onViewFull: (event: CalendarEvent) => void
  onBodyClick: (bodyId: string) => void
  onVenueClick: (venueId: string) => void
}): JSX.Element {
  const isOlympics = event.circuitLevel === 'olympics'
  const isNational = event.circuitLevel === 'national_championship'
  const isClubCard = event.circuitLevel === 'club_card'
  const isInternational = [
    'baltic_championship', 'european_championship', 'world_championship', 'olympics',
  ].includes(event.circuitLevel)

  const dayStructure = CIRCUIT_DAY_STRUCTURE[event.circuitLevel]
  const isMultiDay = dayStructure !== undefined
  const totalDays = dayStructure?.length ?? 1

  // Date shown in header — for single-day events: Saturday; for multi-day: Day 1 → Day N range
  const sat = isMultiDay
    ? eventDayDate(event.year, event.week, 1, totalDays)
    : isoWeekSaturday(event.year, event.week)
  const dateStr = sat.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const nations = participatingNations(event.circuitLevel)
  const entryMethod = selectionMethod(event.circuitLevel)

  // Weight classes sorted heavy → light for consistent top-down display.
  const sortedWeightClasses = sortWeightClassesHeavyFirst(event.weightClasses)

  const accentColor = circuitAccentColor(event.circuitLevel)
  const borderColor = isOlympics
    ? 'rgba(255,209,131,0.25)'
    : 'rgba(218,212,201,0.08)'

  return (
    <div
      style={{
        width: '100%',
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
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '3px',
              lineHeight: 1.3,
            }}
          >
            {event.label}
          </div>
          {isMultiDay && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.4)', marginBottom: 'var(--space-1)' }}>
              {totalDays}-day event
            </div>
          )}
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

        {/* Venue name + Date on the same row; City + Capacity below */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
              marginBottom: '3px',
            }}
          >
            <HoverLink
              label={displayVenueName(event)}
              onClick={() => onVenueClick(event.venueId)}
            />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '10px',
                color: 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                paddingTop: '1px',
              }}
            >
              {dateStr}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <SewingPinIcon width={10} height={10} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                {formatCityDisplay(event)}
              </span>
            </div>
            {event.venueCapacity > 0 && (
              <>
                <span style={{ color: 'rgba(218,212,201,0.2)', fontSize: '9px' }}>·</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.4)' }}>
                  {event.venueCapacity.toLocaleString()} seats
                </span>
              </>
            )}
          </div>
        </div>

        {/* Format indicator */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Row
            label="Format"
            value={
              isClubCard
                ? 'Card · One bout per fighter · Results same night'
                : isMultiDay
                  ? `Tournament · Single Elimination · ${totalDays} Days`
                  : 'Single Day Tournament · Single Elimination'
            }
          />
        </div>

        {/* Governing body — hover-underline link navigates to sanctioning body page */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <SectionLabel label="Sanctioned by" />
          <HoverLink
            label={governingBody(event.circuitLevel)}
            onClick={() => onBodyClick(governingBodyId(event.circuitLevel))}
          />
        </div>

        {/* Multi-day competition schedule */}
        {isMultiDay && dayStructure !== undefined && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <SectionLabel label="Competition Schedule" />
            <div
              style={{
                marginTop: 'var(--space-1)',
                borderLeft: `2px solid ${accentColor}`,
                paddingLeft: 'var(--space-2)',
                opacity: 0.9,
              }}
            >
              {dayStructure.map((ds, i) => {
                const dayDate = eventDayDate(event.year, event.week, i + 1, totalDays)
                const dayOfWeek = dayDate.toLocaleDateString('en-GB', { weekday: 'short' })
                const dayMonth = dayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 'var(--space-2)',
                      padding: '3px 0',
                      borderBottom: i < dayStructure.length - 1 ? '1px solid rgba(218,212,201,0.05)' : 'none',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'rgba(218,212,201,0.4)', minWidth: '36px', flexShrink: 0 }}>
                      Day {i + 1}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'rgba(218,212,201,0.5)', minWidth: '68px', flexShrink: 0 }}>
                      {dayOfWeek} {dayMonth}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {ds.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Club card informal tone */}
        {isClubCard && (
          <div
            style={{
              background: 'rgba(218,212,201,0.04)',
              border: 'var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'rgba(218,212,201,0.5)', lineHeight: 1.5 }}>
              Informal card. One bout per fighter. Results same night. No bracket — fighters are matched on the night.
            </div>
          </div>
        )}

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

        {/* Weight classes — heavy to light */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <SectionLabel label="Weight Classes" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'var(--space-1)' }}>
            {sortedWeightClasses.map(wc => (
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

        {/* View full details link */}
        <div style={{ marginBottom: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: 'var(--border-subtle)' }}>
          <button
            onClick={() => onViewFull(event)}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              color: accentColor,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.textDecoration = 'none' }}
          >
            View Full Details →
          </button>
        </div>

        {/* Entry slots — heavy to light; activation comes with roster system */}
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
            {sortedWeightClasses.map(wc => (
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

// UpcomingEventsPanel shows next events in the right sidebar when no event is selected.
// Compact 2-line rows: circuit pill + event name on top, date + venue below.
// Also shows Future Landmarks — events beyond the calendar window from circuit data.
function UpcomingEventsPanel({ events, currentYear, currentWeek, onSelect, gameData }: {
  events: CalendarEvent[]
  currentYear: number
  currentWeek: number
  onSelect: (event: CalendarEvent) => void
  gameData: GameData | null
}): JSX.Element {
  const upcoming = events
    .filter(e =>
      e.year > currentYear ||
      (e.year === currentYear && e.week >= currentWeek),
    )
    .slice(0, 12)

  return (
    <div
      style={{
        width: '100%',
        backgroundColor: 'rgba(10,10,14,0.4)',
        border: 'var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: 'var(--border-subtle)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'rgba(218,212,201,0.35)',
          }}
        >
          Upcoming Events
        </span>
      </div>
      {upcoming.length === 0 ? (
        <div style={{ padding: 'var(--space-4) var(--space-3)', textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(218,212,201,0.3)' }}>
            No upcoming events
          </span>
        </div>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {upcoming.map((event, i) => {
            const sat = isoWeekSaturday(event.year, event.week)
            const dateStr = sat.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            const isLast = i === upcoming.length - 1
            return (
              <button
                key={event.id}
                onClick={() => onSelect(event)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'none',
                  border: 'none',
                  borderBottom: isLast ? 'none' : 'var(--border-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* Top row: circuit badge + event label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '2px' }}>
                  <Badge variant={circuitBadgeVariant(event.circuitLevel)} label={circuitLabel(event.circuitLevel)} />
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '11px',
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      flex: 1,
                    }}
                  >
                    {event.label}
                  </span>
                </div>
                {/* Bottom row: date + venue · city */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '9px',
                      color: 'rgba(218,212,201,0.35)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {dateStr} {event.year}
                  </span>
                  <span style={{ color: 'rgba(218,212,201,0.2)', fontSize: '9px', flexShrink: 0 }}>·</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '9px',
                      color: 'rgba(218,212,201,0.35)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {formatCityDisplay(event)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Future Landmarks — aspirational events beyond the generated calendar window.
          Pulled from international circuit nextOccurrence for Olympics and Worlds. */}
      <FutureLandmarks gameData={gameData} calendarEvents={events} />
    </div>
  )
}

// FutureLandmarks shows circuit events scheduled beyond the generated calendar window.
// Only shows events that have a nextOccurrence that is NOT already in calendarEvents.
function FutureLandmarks({ gameData, calendarEvents }: {
  gameData: GameData | null
  calendarEvents: CalendarEvent[]
}): JSX.Element | null {
  if (gameData === null) return null

  const generatedYears = new Set(calendarEvents.map(e => `${e.circuitLevel}-${e.year}`))

  // Collect landmarks: international circuits with nextOccurrence not already generated.
  const landmarks = gameData.international.boxing.circuits.circuitLevels
    .filter(c => c.nextOccurrence !== undefined && !generatedYears.has(`${c.id}-${c.nextOccurrence}`))
    .map(c => ({ id: c.id, label: c.label, year: c.nextOccurrence!, selectionMethod: c.selectionMethod }))

  if (landmarks.length === 0) return null

  return (
    <div
      style={{
        borderTop: 'var(--border-subtle)',
        padding: 'var(--space-2) var(--space-3)',
      }}
    >
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
        Future Landmarks
      </div>
      {landmarks.map(lm => {
        const isOlympics = lm.id === 'olympics'
        return (
          <div
            key={lm.id}
            style={{
              padding: 'var(--space-2) 0',
              borderBottom: 'var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              {isOlympics && <span style={{ fontSize: '11px' }}>🥇</span>}
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  fontWeight: isOlympics ? 700 : 600,
                  color: isOlympics ? 'var(--color-accent-gold)' : 'var(--color-text-primary)',
                }}
              >
                {lm.label.split(' ').slice(0, 3).join(' ')} {lm.year}
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'rgba(218,212,201,0.4)' }}>
              {lm.selectionMethod === 'federation_selection' ? 'Selection via federation' : 'Open entry'}
            </div>
          </div>
        )
      })}
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
  const gameData = useGameStore(s => s.gameData)

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
    // Read viewMonth from closure, not from inside setViewMonth updater.
    // Calling setViewYear inside a setViewMonth updater fires twice in React Strict Mode,
    // causing the year to jump by 2 instead of 1.
    if (viewMonth === 1) {
      setViewMonth(12)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
    setSelectedEvent(null)
  }, [viewMonth])

  // maxNavigableMonth/Year caps navigation at the last month that has a generated event.
  // Prevents navigating into empty months beyond the generated calendar window.
  const maxNavYear = events.length > 0
    ? Math.max(...events.map(e => e.year))
    : viewYear
  const maxNavMonth = events.length > 0
    ? Math.max(...events.filter(e => e.year === maxNavYear).map(e => weekToMonth(e.week)))
    : viewMonth

  const atNavLimit =
    viewYear > maxNavYear ||
    (viewYear === maxNavYear && viewMonth >= maxNavMonth)

  const navigateNextMonth = useCallback((): void => {
    // Never navigate past the last month that has generated events.
    if (atNavLimit) return
    if (viewMonth === 12) {
      setViewMonth(1)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
    setSelectedEvent(null)
  }, [viewMonth, atNavLimit])

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

  // Navigation helpers for the new detail pages (Part 2g / Part 6).
  function navigateToEventFull(event: CalendarEvent): void {
    setScreen('eventFull', {
      calendarEvent: event,
      returnMonth: viewMonth,
      returnYear: viewYear,
    })
  }

  function navigateToBody(bodyId: string): void {
    setScreen('sanctioningBody', { bodyId })
  }

  function navigateToVenue(venueId: string): void {
    setScreen('venue', { venueId })
  }

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

  return (
    <GameShell activeNav="calendar" onNavigate={handleNavigate}>
      {/* Month navigation row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}
      >
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
            disabled={atNavLimit}
            aria-label="Next month"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: atNavLimit ? 'not-allowed' : 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              opacity: atNavLimit ? 0.3 : 1,
            }}
          >
            <ChevronRightIcon width={16} height={16} />
          </button>
        </div>
        {/* Calendar limit note — only visible when at the edge of generated data */}
        {atNavLimit && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'rgba(218,212,201,0.35)' }}>
            Calendar generated to {MONTH_NAMES[maxNavMonth]} {maxNavYear}
          </span>
        )}
      </div>

      {loading ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Loading calendar…
        </p>
      ) : (
        // Two-column layout: calendar grid left, right panel always present.
        // The right column is a fixed width — switching between upcoming list and
        // event detail doesn't change any heights, so the calendar never shifts down.
        // When a detail panel is open, a transparent overlay sits in front of the grid
        // so clicking outside the panel closes it (Part 2c).
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start', position: 'relative' }}>
          {/* Click-outside overlay — covers the grid when detail panel is open */}
          {selectedEvent !== null && (
            <div
              onClick={() => setSelectedEvent(null)}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                cursor: 'default',
              }}
            />
          )}
          {/* Calendar grid — takes remaining width */}
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
                const daySlots = day !== null
                  ? getEventDaysOnDate(events, viewYear, viewMonth, day)
                  : []

                const isToday =
                  todaySat !== null &&
                  day !== null &&
                  todaySat.getFullYear() === viewYear &&
                  todaySat.getMonth() + 1 === viewMonth &&
                  todaySat.getDate() === day

                // Each event gets an equal vertical section of the cell.
                // Minimum section height for text to render — below this only colour shows.
                const CELL_MIN_H = 72
                const sectionHeightPx = daySlots.length > 0
                  ? Math.floor(CELL_MIN_H / daySlots.length)
                  : CELL_MIN_H

                return (
                  <div
                    key={idx}
                    onClick={daySlots.length === 1 ? () => setSelectedEvent(daySlots[0]!.event) : undefined}
                    style={{
                      minHeight: `${CELL_MIN_H}px`,
                      position: 'relative',
                      background: day === null
                        ? 'transparent'
                        : isToday
                          ? 'rgba(238,178,74,0.05)'
                          : daySlots.length === 0
                            ? 'rgba(218,212,201,0.02)'
                            : 'transparent',
                      border: day === null
                        ? 'none'
                        : isToday
                          ? '1px solid rgba(238,178,74,0.2)'
                          : 'var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      cursor: daySlots.length === 1 ? 'pointer' : 'default',
                    }}
                  >
                    {day !== null && (
                      <>
                        {/* Colour background sections — one per event, equal height splits */}
                        {daySlots.map(({ event }, slotIdx) => (
                          <div
                            key={`bg-${event.id}-${slotIdx}`}
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: `${(slotIdx / daySlots.length) * 100}%`,
                              height: `${(1 / daySlots.length) * 100}%`,
                              background: circuitCellBgColor(event.circuitLevel),
                            }}
                          />
                        ))}

                        {/* Day number — top right, above colour sections */}
                        <div
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            fontFamily: 'var(--font-body)',
                            fontSize: '10px',
                            color: isToday
                              ? 'var(--color-accent-amber)'
                              : 'rgba(218,212,201,0.35)',
                            textAlign: 'right',
                            padding: '3px 4px 0',
                            fontWeight: isToday ? 700 : 400,
                          }}
                        >
                          {day}
                        </div>

                        {/* Event name in lower portion of each colour section.
                            Skip text if the section is too narrow to be readable. */}
                        {daySlots.map(({ event }, slotIdx) => (
                          sectionHeightPx >= 20 && (
                            <div
                              key={`text-${event.id}-${slotIdx}`}
                              onClick={(e) => { e.stopPropagation(); setSelectedEvent(event) }}
                              style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                top: `${(slotIdx / daySlots.length) * 100}%`,
                                height: `${(1 / daySlots.length) * 100}%`,
                                display: 'flex',
                                alignItems: 'flex-end',
                                padding: '2px 4px',
                                zIndex: 1,
                                cursor: 'pointer',
                                boxSizing: 'border-box',
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'var(--font-body)',
                                  fontSize: '10px',
                                  color: 'var(--color-text-primary)',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  textOverflow: 'ellipsis',
                                  display: 'block',
                                  width: '100%',
                                  lineHeight: 1.3,
                                }}
                              >
                                {event.label}
                              </span>
                            </div>
                          )
                        ))}
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend — coloured squares matching the cell section background tints */}
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
                  ['club_card',             'Club Card'],
                  ['regional_tournament',   'Regional'],
                  ['national_championship', 'Nationals'],
                  ['baltic_championship',   'Baltic'],
                  ['european_championship', 'European'],
                  ['world_championship',    'Worlds'],
                  ['olympics',              'Olympics'],
                ] as [CalendarEvent['circuitLevel'], string][]
              ).map(([level, label]) => (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      display: 'block',
                      background: circuitCellBgColor(level),
                      border: 'var(--border-subtle)',
                      borderRadius: '2px',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '9px', color: 'rgba(218,212,201,0.4)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — fixed 280px, always rendered.
              Shows the event detail panel when an event is selected,
              upcoming events list otherwise. No vertical layout shift.
              zIndex 2 ensures this sits above the click-outside overlay. */}
          <div style={{ width: '280px', flexShrink: 0, position: 'relative', zIndex: 2 }}>
            {selectedEvent !== null ? (
              <EventDetailPanel
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
                onViewFull={navigateToEventFull}
                onBodyClick={navigateToBody}
                onVenueClick={navigateToVenue}
              />
            ) : (
              <UpcomingEventsPanel
                events={events}
                currentYear={worldState.currentYear}
                currentWeek={worldState.currentWeek}
                onSelect={setSelectedEvent}
                gameData={gameData}
              />
            )}
          </div>
        </div>
      )}
    </GameShell>
  )
}
