// generateCalendar produces CalendarEvents for a given year window.
// It reads EventTemplates from the nation bundle and international data,
// places events on the timeline respecting real timing constraints,
// and assigns venues from eligible pools.
//
// Generation rules:
// 1. Game starts mid-year — generate remainder of start year + full next year.
// 2. Every January 1st in simulation — generate the new full year.
// 3. National championship always in November — typicalMonths is a hard constraint here.
// 4. Olympics and World Championship respect frequencyYears and nextOccurrence.
// 5. Host city rotation for national championship tracks current index in WorldState.
// 6. No two major events (national_championship or above) in the same week.
// 7. Club tournaments and regional opens can overlap — they run in different cities.

import type { GameData, NationBoxingData } from '../data/loader.js'
import type { GameConfig } from '../types/gameConfig.js'
import type { WorldState } from '../types/worldState.js'
import type { CalendarEvent } from '../types/calendar.js'
import type { EventTemplate, Venue, CircuitLevel, FrequencyRange } from '../types/data/boxing.js'
import type { RNG } from '../utils/rng.js'

// MAJOR_LEVELS are circuit levels that cannot share a week.
// Club and regional events can overlap because they run in different cities.
const MAJOR_LEVELS = new Set<CircuitLevel>([
  'national_championship',
  'baltic_championship',
  'european_championship',
  'world_championship',
  'olympics',
])

// ISO week ranges for each month — used to map typicalMonths to valid weeks.
// Week boundaries are approximate (months do not divide evenly into ISO weeks)
// but sufficient for calendar placement. Exact dates are not the goal here —
// the week number gives the simulation enough precision to sequence events.
const MONTH_WEEK_RANGES: Record<number, [number, number]> = {
  1:  [1,  4],
  2:  [5,  8],
  3:  [9,  13],
  4:  [14, 17],
  5:  [18, 21],
  6:  [22, 26],
  7:  [27, 30],
  8:  [31, 34],
  9:  [35, 39],
  10: [40, 43],
  11: [44, 48],
  12: [49, 52],
}

// cityShortId extracts the city's short name from its full id.
// City ids are nation-prefixed (e.g. "latvia-riga") but venue city fields
// use the short form ("riga"). This keeps venue data readable without
// requiring nation context in every venue entry.
function cityShortId(cityId: string): string {
  const parts = cityId.split('-')
  // Strip the nation prefix (first segment) — join remainder to handle
  // multi-segment city names (e.g. a future "usa-new-york" → "new-york").
  return parts.slice(1).join('-')
}

// pickWeekInMonth returns a deterministic week number within a calendar month.
// Using RNG rather than the first week of each month gives the calendar natural
// variation — events don't all land on the same week number across years.
function pickWeekInMonth(month: number, rng: RNG): number {
  const [lo, hi] = MONTH_WEEK_RANGES[month] ?? [1, 52]
  return rng.nextInt(lo, hi)
}

// resolveFrequency returns a concrete count from a fixed number or range.
function resolveFrequency(freq: number | FrequencyRange, rng: RNG): number {
  if (typeof freq === 'number') return freq
  return rng.nextInt(freq.min, freq.max)
}

// buildVenueMap merges all venue lists (national + international) into one lookup.
// Venue ids are globally unique across files — this map makes venue resolution O(1).
function buildVenueMap(data: GameData): Map<string, Venue> {
  const map = new Map<string, Venue>()
  for (const venue of data.international.boxing.venues.venues) {
    map.set(venue.id, venue)
  }
  for (const bundle of Object.values(data.nations)) {
    if (bundle.boxing !== undefined) {
      for (const venue of bundle.boxing.venues.venues) {
        map.set(venue.id, venue)
      }
    }
  }
  return map
}

// pickVenue selects a venue from the template's venuePool filtered by circuit level
// and city. If a city filter is provided, only venues in that city are eligible.
// Throws a descriptive error if no venue is found — a missing venue is a data bug.
function pickVenue(
  template: EventTemplate,
  circuitLevel: CircuitLevel,
  cityShort: string | null,
  venueMap: Map<string, Venue>,
  rng: RNG,
): Venue {
  const pool = template.venuePool ?? []
  const eligible = pool
    .map(id => venueMap.get(id))
    .filter((v): v is Venue => {
      if (v === undefined) return false
      if (!v.eligibleFor.includes(circuitLevel)) return false
      if (cityShort !== null && v.city !== cityShort) return false
      return true
    })

  if (eligible.length === 0) {
    const cityHint = cityShort !== null ? ` in city "${cityShort}"` : ''
    throw new Error(
      `No eligible venue found for template "${template.id}" (${circuitLevel})${cityHint}. ` +
      `Check venuePool ids and eligibleFor fields in venues.json.`,
    )
  }

  return rng.pick(eligible)
}

// makeEventId produces a stable, human-readable id for a generated event.
// Includes year, week, templateId, and cityId so the id is unique per slot.
function makeEventId(templateId: string, cityId: string, year: number, week: number): string {
  return `${templateId}--${cityId}--${year}w${week.toString().padStart(2, '0')}`
}

// generateDomesticEvents generates all events for one nation's boxing templates.
// Returns new events and mutates worldState.rotationIndices for host city rotation.
function generateDomesticEvents(
  nationId: string,
  boxing: NationBoxingData,
  startYear: number,
  startWeek: number,
  yearsToGenerate: number[],
  venueMap: Map<string, Venue>,
  occupiedMajorWeeks: Set<string>,
  worldState: WorldState,
  rng: RNG,
): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const template of boxing.eventTemplates.eventTemplates) {
    if (template.frequencyYears !== undefined) continue // international template, skip

    const circuitLevel = template.circuitLevel

    for (const year of yearsToGenerate) {
      const weekFloor = year === startYear ? startWeek : 1

      if (template.locationScope === 'national' && template.hostCityRotation !== undefined) {
        // National championship — one event per year, always November (hard constraint).
        // Host city advances through the rotation tracked in worldState.rotationIndices.
        const rotKey = template.id
        const rotIndex = worldState.rotationIndices[rotKey] ?? 0
        const hostCityShort = template.hostCityRotation[rotIndex % template.hostCityRotation.length]
        if (hostCityShort === undefined) continue

        // Advance the rotation index so the next generation picks the next city.
        worldState.rotationIndices[rotKey] = (rotIndex + 1) % template.hostCityRotation.length

        const hostCityId = `${nationId}-${hostCityShort}`
        const month = 11 // National championship always November — hard constraint
        const week = Math.max(weekFloor, pickWeekInMonth(month, rng))
        const weekKey = `${year}-${week}`

        // Major events cannot share a week — skip if already occupied.
        if (MAJOR_LEVELS.has(circuitLevel) && occupiedMajorWeeks.has(weekKey)) continue
        if (MAJOR_LEVELS.has(circuitLevel)) occupiedMajorWeeks.add(weekKey)

        const venue = pickVenue(template, circuitLevel, hostCityShort, venueMap, rng)
        const weightClasses = data_weightClasses(template)

        events.push({
          id: makeEventId(template.id, hostCityId, year, week),
          templateId: template.id,
          circuitLevel,
          label: template.label,
          venueId: venue.id,
          cityId: hostCityId,
          nationId,
          year,
          week,
          weightClasses,
          status: 'scheduled',
          boutIds: [],
        })

      } else if (template.locationScope === 'city') {
        // Club tournaments — one set of events per city that has eligible venues.
        // Each city generates its own events independently.
        const freq = template.frequencyPerYear !== undefined
          ? resolveFrequency(template.frequencyPerYear, rng)
          : 6

        const eligibleCities = findCitiesWithVenues(
          nationId, template, circuitLevel, venueMap,
        )

        for (const cityId of eligibleCities) {
          const cityShort = cityShortId(cityId)
          const distributed = distributeAcrossMonths(
            freq, template.typicalMonths, weekFloor, rng,
          )
          for (const week of distributed) {
            const venue = pickVenue(template, circuitLevel, cityShort, venueMap, rng)
            const weightClasses = data_weightClasses(template)
            events.push({
              id: makeEventId(template.id, cityId, year, week),
              templateId: template.id,
              circuitLevel,
              label: template.label,
              venueId: venue.id,
              cityId,
              nationId,
              year,
              week,
              weightClasses,
              status: 'scheduled',
              boutIds: [],
            })
          }
        }

      } else if (template.locationScope === 'regional') {
        // Regional opens — one event per city that has a regional-eligible venue.
        // Each region is represented by its host city's main venue.
        const freq = template.frequencyPerYear !== undefined
          ? resolveFrequency(template.frequencyPerYear, rng)
          : 3

        const eligibleCities = findCitiesWithVenues(
          nationId, template, circuitLevel, venueMap,
        )

        for (const cityId of eligibleCities) {
          const cityShort = cityShortId(cityId)
          const distributed = distributeAcrossMonths(
            freq, template.typicalMonths, weekFloor, rng,
          )
          for (const week of distributed) {
            const venue = pickVenue(template, circuitLevel, cityShort, venueMap, rng)
            const weightClasses = data_weightClasses(template)
            events.push({
              id: makeEventId(template.id, cityId, year, week),
              templateId: template.id,
              circuitLevel,
              label: template.label,
              venueId: venue.id,
              cityId,
              nationId,
              year,
              week,
              weightClasses,
              status: 'scheduled',
              boutIds: [],
            })
          }
        }
      }
    }
  }

  return events
}

// generateInternationalEvents generates events for international-level templates.
// Uses frequencyYears + nextOccurrence to determine which years to generate.
function generateInternationalEvents(
  data: GameData,
  config: GameConfig,
  yearsToGenerate: number[],
  venueMap: Map<string, Venue>,
  occupiedMajorWeeks: Set<string>,
  rng: RNG,
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const templates = data.international.boxing.eventTemplates.eventTemplates
  const circuits = data.international.boxing.circuits.circuitLevels

  // Build a map of nextOccurrence per circuit level from the circuits data.
  // nextOccurrence drives when this event is generated — after each run the
  // engine would add frequencyYears, but for initial generation we just use
  // the declared nextOccurrence.
  const nextOccurrenceMap = new Map<CircuitLevel, { year: number; freq: number }>()
  for (const circuit of circuits) {
    if (circuit.nextOccurrence !== undefined && circuit.frequencyYears !== undefined) {
      nextOccurrenceMap.set(circuit.id, {
        year: circuit.nextOccurrence,
        freq: circuit.frequencyYears,
      })
    }
  }

  for (const template of templates) {
    if (template.frequencyYears === undefined) continue

    const circuitLevel = template.circuitLevel
    const occurrence = nextOccurrenceMap.get(circuitLevel)
    if (occurrence === undefined) continue

    for (const year of yearsToGenerate) {
      // Generate this international event only in years it is scheduled.
      // For the initial calendar window (start year + 1) we check all years
      // that are multiples of frequencyYears from nextOccurrence.
      const yearsSinceNext = year - occurrence.year
      const isScheduledYear =
        yearsSinceNext === 0 ||
        (yearsSinceNext > 0 && yearsSinceNext % occurrence.freq === 0)

      if (!isScheduledYear) continue

      const month = rng.pick(template.typicalMonths)
      const week = pickWeekInMonth(month, rng)
      const weekKey = `${year}-${week}`

      if (MAJOR_LEVELS.has(circuitLevel) && occupiedMajorWeeks.has(weekKey)) {
        // Try adjacent weeks to avoid collision before giving up.
        const alt = week < 52 ? week + 1 : week - 1
        const altKey = `${year}-${alt}`
        if (occupiedMajorWeeks.has(altKey)) continue
        occupiedMajorWeeks.add(altKey)
        const venue = pickVenue(template, circuitLevel, null, venueMap, rng)
        const weightClasses = data_weightClasses(template)
        // International events have no single nation host — use the first rendered nation.
        const nationId = config.renderedNations[0] ?? 'international'
        events.push({
          id: makeEventId(template.id, nationId, year, alt),
          templateId: template.id,
          circuitLevel,
          label: template.label,
          venueId: venue.id,
          cityId: venue.city,
          nationId,
          year,
          week: alt,
          weightClasses,
          status: 'scheduled',
          boutIds: [],
        })
        continue
      }

      if (MAJOR_LEVELS.has(circuitLevel)) occupiedMajorWeeks.add(weekKey)

      const venue = pickVenue(template, circuitLevel, null, venueMap, rng)
      const weightClasses = data_weightClasses(template)
      const nationId = config.renderedNations[0] ?? 'international'

      events.push({
        id: makeEventId(template.id, nationId, year, week),
        templateId: template.id,
        circuitLevel,
        label: template.label,
        venueId: venue.id,
        cityId: venue.city,
        nationId,
        year,
        week,
        weightClasses,
        status: 'scheduled',
        boutIds: [],
      })
    }
  }

  return events
}

// findCitiesWithVenues returns all city ids (in full form e.g. "latvia-riga")
// for a nation that have at least one venue eligible for the given template + circuit.
function findCitiesWithVenues(
  nationId: string,
  template: EventTemplate,
  circuitLevel: CircuitLevel,
  venueMap: Map<string, Venue>,
): string[] {
  const pool = template.venuePool ?? []
  const eligibleCities = new Set<string>()

  for (const venueId of pool) {
    const venue = venueMap.get(venueId)
    if (venue === undefined) continue
    if (!venue.eligibleFor.includes(circuitLevel)) continue
    // Reconstruct the full city id from nation + venue.city.
    eligibleCities.add(`${nationId}-${venue.city}`)
  }

  return Array.from(eligibleCities)
}

// distributeAcrossMonths spreads `count` events across the given months,
// returning a list of week numbers. Events are distributed evenly across
// typicalMonths — if count > months, some months get multiple events.
// weeks that fall before weekFloor (already past in the start year) are skipped.
function distributeAcrossMonths(
  count: number,
  typicalMonths: number[],
  weekFloor: number,
  rng: RNG,
): number[] {
  if (typicalMonths.length === 0) return []

  const weeks: number[] = []
  for (let i = 0; i < count; i++) {
    const month = typicalMonths[i % typicalMonths.length]
    if (month === undefined) continue
    const week = pickWeekInMonth(month, rng)
    // Skip events that have already passed in the start year.
    if (week < weekFloor) continue
    weeks.push(week)
  }
  return weeks
}

// data_weightClasses resolves the weight classes for an event.
// All 10 weight classes are used when weightClassCount is a fixed 10.
// When it is a range, we pick randomly; when it is a smaller fixed number
// we take the first N classes. Placeholder returns string indices until
// the weight class selection system is implemented.
function data_weightClasses(template: EventTemplate): string[] {
  const count = typeof template.weightClassCount === 'number'
    ? template.weightClassCount
    : rng_placeholder_count(template.weightClassCount.min, template.weightClassCount.max)
  // Placeholder: weight class ids will come from data.weightClasses in a future pass.
  // Using index strings keeps this self-contained without a circular dependency.
  return Array.from({ length: count }, (_, i) => `weight_class_${i + 1}`)
}

// rng_placeholder_count is used only by data_weightClasses above.
// A proper RNG is not available at module scope — this uses the midpoint.
// When full weight-class selection is implemented this function will be removed.
function rng_placeholder_count(min: number, max: number): number {
  return Math.floor((min + max) / 2)
}

export function generateCalendar(
  startYear: number,
  startWeek: number,
  config: GameConfig,
  data: GameData,
  rng: RNG,
  worldState: WorldState,
): CalendarEvent[] {
  // Generate remainder of startYear + full next year.
  // This gives the player a meaningful forward view from any start point.
  const yearsToGenerate = [startYear, startYear + 1]

  const venueMap = buildVenueMap(data)
  const occupiedMajorWeeks = new Set<string>()
  const allEvents: CalendarEvent[] = []

  // Domestic events for each rendered nation that has boxing data.
  for (const nationId of config.renderedNations) {
    const bundle = data.nations[nationId]
    if (bundle === undefined || bundle.boxing === undefined) continue

    const domestic = generateDomesticEvents(
      nationId,
      bundle.boxing,
      startYear,
      startWeek,
      yearsToGenerate,
      venueMap,
      occupiedMajorWeeks,
      worldState,
      rng,
    )
    allEvents.push(...domestic)
  }

  // International events (Baltic, European, World, Olympics).
  const international = generateInternationalEvents(
    data,
    config,
    yearsToGenerate,
    venueMap,
    occupiedMajorWeeks,
    rng,
  )
  allEvents.push(...international)

  // Remove any events that fall before the start week in the start year.
  // International events are generated without a week floor — this single
  // post-pass handles all templates uniformly rather than threading startWeek
  // through every generator function.
  const filtered = allEvents.filter(
    e => !(e.year === startYear && e.week < startWeek),
  )

  // Sort by year then week for predictable ordering.
  filtered.sort((a, b) => a.year !== b.year ? a.year - b.year : a.week - b.week)

  return filtered
}
