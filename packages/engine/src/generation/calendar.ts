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
// 7. Club tournaments use nation-level slot distribution:
//    all cities' events are spread across the full competition season first,
//    then assigned to cities in round-robin order so each city's events
//    fall in different parts of the year.
// 8. Regional opens use window-based distribution: events land only in the
//    spring or autumn windows defined by the national body's calendarRules.
//    No two regional opens share a week.
// 9. Event frequency for domestic events comes from city data, not template defaults.
// 10. Weight classes use real ids from data, with lighter classes biased for club events.

import type { GameData, NationBoxingData } from '../data/loader.js'
import type { GameConfig } from '../types/gameConfig.js'
import type { WorldState } from '../types/worldState.js'
import type { CalendarEvent } from '../types/calendar.js'
import type { EventTemplate, Venue, CircuitLevel, NationalCalendarRules } from '../types/data/boxing.js'
import type { CitiesData, City } from '../types/data/cities.js'
import type { WeightClass } from '../types/data/weightClasses.js'
import type { RNG } from '../utils/rng.js'

// MAJOR_LEVELS are circuit levels that cannot share a week.
// Club cards and regional tournaments can overlap because they run in different cities.
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

// getCityLabel looks up the human-readable city name from the nation bundle.
// Falls back to formatting the cityId if the city isn't found — handles
// international events where cityId is a raw display string, not a data id.
function getCityLabel(cityId: string, nationId: string, data: GameData): string {
  const bundle = data.nations[nationId]
  if (bundle !== undefined) {
    const city = bundle.cities.cities.find(c => c.id === cityId)
    if (city !== undefined) return city.label
  }
  // International or unresolved — strip nation prefix and title-case.
  const short = cityId.replace(/^[^-]+-/, '')
  return short.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// getVenueFirstWord returns the first word of a venue name for disambiguation.
// Used when two club shows in the same city share the base name.
// "Imanta Sporta Halle" → "Imanta", "Daugavpils Boksa Klubs" → "Daugavpils"
function getVenueFirstWord(venueId: string, venueMap: Map<string, Venue>): string {
  const venue = venueMap.get(venueId)
  if (venue !== undefined) {
    const first = venue.name.split(' ')[0]
    if (first !== undefined && first.length > 0) return first
  }
  return venueId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// generateEventName produces a unique, realistic event name.
// Naming follows real boxing conventions: [Year] [Location/Venue] [Type]
// For events that occur multiple times per year in the same city,
// the venue name is used to differentiate. If still not unique,
// a sequence number is appended.
// The usedNames set tracks names already assigned in the current
// generation pass to guarantee uniqueness within a calendar year.
function generateEventName(
  template: EventTemplate,
  cityId: string,
  venueId: string,
  year: number,
  nationId: string,
  data: GameData,
  venueMap: Map<string, Venue>,
  usedNames: Set<string>,
): string {
  const level = template.circuitLevel

  // Fixed-name international events — always unique per year.
  if (level === 'national_championship') {
    const name = `${year} Latvian National Championships`
    usedNames.add(name)
    return name
  }
  if (level === 'baltic_championship') {
    const name = `${year} Baltic Boxing Championships`
    usedNames.add(name)
    return name
  }
  if (level === 'european_championship') {
    const name = `${year} European Amateur Boxing Championships`
    usedNames.add(name)
    return name
  }
  if (level === 'world_championship') {
    const name = `${year} IBA World Boxing Championships`
    usedNames.add(name)
    return name
  }
  if (level === 'olympics') {
    const name = `${year} Olympic Games Boxing`
    usedNames.add(name)
    return name
  }

  const cityLabel = getCityLabel(cityId, nationId, data)

  if (level === 'regional_tournament') {
    const base = `${year} ${cityLabel} Open`
    if (!usedNames.has(base)) {
      usedNames.add(base)
      return base
    }
    let seq = 2
    while (true) {
      const candidate = `${year} ${cityLabel} Open #${seq}`
      if (!usedNames.has(candidate)) {
        usedNames.add(candidate)
        return candidate
      }
      seq++
    }
  }

  // club_card — base name is [Year] [City] Club Show.
  const base = `${year} ${cityLabel} Club Show`
  if (!usedNames.has(base)) {
    usedNames.add(base)
    return base
  }
  // Disambiguate with first word of venue name.
  const venueWord = getVenueFirstWord(venueId, venueMap)
  const withVenue = `${year} ${cityLabel} ${venueWord} Show`
  if (!usedNames.has(withVenue)) {
    usedNames.add(withVenue)
    return withVenue
  }
  // Final fallback: sequence number.
  let seq = 2
  while (true) {
    const candidate = `${year} ${cityLabel} Club Show #${seq}`
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate)
      return candidate
    }
    seq++
  }
}

// pickWeightClasses selects weight class ids for an event.
// For club tournaments, lighter weight classes are biased more heavily —
// they dominate grassroots boxing, where smaller fighters are most common.
// For other events, selection is uniform across all classes.
function pickWeightClasses(
  template: EventTemplate,
  allWeightClasses: WeightClass[],
  rng: RNG,
): string[] {
  const count = typeof template.weightClassCount === 'number'
    ? template.weightClassCount
    : rng.nextInt(template.weightClassCount.min, template.weightClassCount.max)

  const n = allWeightClasses.length
  if (count >= n) {
    // All classes — no selection needed.
    return allWeightClasses.map(wc => wc.id)
  }

  // Lighter classes dominate club-level boxing — assign descending weights
  // so flyweight is n× more likely than super_heavyweight to be included.
  const isClub = template.circuitLevel === 'club_card'
  const baseWeights = isClub
    ? allWeightClasses.map((_, i) => n - i)  // 10, 9, 8 … 1 for n=10
    : allWeightClasses.map(() => 1)           // equal probability

  // Weighted sampling without replacement: pick one class at a time, remove it
  // from the pool so each class appears at most once in the result.
  const remaining = allWeightClasses.map(wc => wc.id)
  const weights = [...baseWeights]
  const selected: string[] = []

  for (let i = 0; i < count; i++) {
    if (remaining.length === 0) break
    const picked = rng.weightedPick(remaining, weights)
    selected.push(picked)
    const idx = remaining.indexOf(picked)
    remaining.splice(idx, 1)
    weights.splice(idx, 1)
  }

  return selected
}

// generateDomesticEvents generates all events for one nation's boxing templates.
// Returns new events and mutates worldState.rotationIndices for host city rotation.
function generateDomesticEvents(
  nationId: string,
  boxing: NationBoxingData,
  citiesData: CitiesData,
  allWeightClasses: WeightClass[],
  startYear: number,
  startWeek: number,
  yearsToGenerate: number[],
  venueMap: Map<string, Venue>,
  occupiedMajorWeeks: Set<string>,
  worldState: WorldState,
  rng: RNG,
  data: GameData,
  usedNames: Set<string>,
): CalendarEvent[] {
  const events: CalendarEvent[] = []

  // Build a city lookup map for fast per-city frequency access.
  // Frequency comes from city.eventHostingFrequency rather than template defaults —
  // this ensures Riga generates more events than Jēkabpils.
  const cityLookup = new Map<string, City>()
  for (const city of citiesData.cities) {
    cityLookup.set(city.id, city)
  }

  // Extract the national calendar rules from the sanctioning body if available.
  // These rules define the competition season and minimum spacing between events.
  // Without rules the engine falls back to template typicalMonths and hardcoded gaps.
  const calendarRules: NationalCalendarRules | undefined =
    boxing.sanctioningBodies.sanctioningBodies.find(b => b.calendarRules !== undefined)?.calendarRules

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
        const weightClasses = pickWeightClasses(template, allWeightClasses, rng)
        const name = generateEventName(template, hostCityId, venue.id, year, nationId, data, venueMap, usedNames)

        events.push({
          id: makeEventId(template.id, hostCityId, year, week),
          templateId: template.id,
          circuitLevel,
          name,
          label: template.label,
          venueId: venue.id,
          venueName: venue.name,
          venueCapacity: venue.capacity,
          cityId: hostCityId,
          nationId,
          year,
          week,
          weightClasses,
          status: 'scheduled',
          boutIds: [],
        })

      } else if (template.locationScope === 'city') {
        // Club tournaments — nation-level slot distribution.
        //
        // Old approach (broken): per-city round-robin from typicalMonths[0] → all cities
        // picked January first, February second — every event in the first 3 months.
        //
        // New approach: collect all events needed across all cities, build season slots
        // spread evenly across the full competition season, assign to cities in
        // round-robin order so each city's events fall in different parts of the year.
        const eligibleCities = findCitiesWithVenues(nationId, template, circuitLevel, venueMap)

        // Build (city, freq) pairs — zero-freq cities are excluded.
        const cityFreqs: Array<{ cityId: string; freq: number }> = []
        for (const cityId of eligibleCities) {
          const cityData = cityLookup.get(cityId)
          const cityFreq = cityData?.eventHostingFrequency?.club_card
          const freq = cityFreq !== undefined
            ? rng.nextInt(cityFreq.min, cityFreq.max)
            : 1  // conservative fallback
          if (freq > 0) cityFreqs.push({ cityId, freq })
        }

        const total = cityFreqs.reduce((sum, cf) => sum + cf.freq, 0)
        if (total === 0) continue

        // Season slot pool: full competition season from calendar rules, or
        // fall back to template typicalMonths. Minimum 2-week gap between events.
        const seasonMonths = calendarRules?.competitionSeasonMonths ?? template.typicalMonths
        const minGap = calendarRules?.clubTournament.minWeeksBetweenEvents ?? 2
        const slots = buildSeasonSlots(seasonMonths, total, minGap, weekFloor, rng)

        // Interleave cities round-robin by event index.
        // Riga (freq=2) gets slots[0] and slots[3]; Daugavpils (freq=1) gets slots[1], etc.
        // This spreads each city across the year rather than grouping all Riga events together.
        const interleaved = interleaveCity(cityFreqs)

        for (let i = 0; i < interleaved.length && i < slots.length; i++) {
          const entry = interleaved[i]
          const week = slots[i]
          if (entry === undefined || week === undefined) continue

          const cityShort = cityShortId(entry.cityId)
          const venue = pickVenue(template, circuitLevel, cityShort, venueMap, rng)
          const weightClasses = pickWeightClasses(template, allWeightClasses, rng)
          const name = generateEventName(template, entry.cityId, venue.id, year, nationId, data, venueMap, usedNames)

          events.push({
            id: makeEventId(template.id, entry.cityId, year, week),
            templateId: template.id,
            circuitLevel,
            name,
            label: template.label,
            venueId: venue.id,
            venueName: venue.name,
            venueCapacity: venue.capacity,
            cityId: entry.cityId,
            nationId,
            year,
            week,
            weightClasses,
            status: 'scheduled',
            boutIds: [],
          })
        }

      } else if (template.locationScope === 'regional') {
        // Regional opens — window-based nation-level slot distribution.
        //
        // Events land only within defined seasonal windows (spring: Feb/Mar, autumn: Sep/Oct).
        // Cities are interleaved across windows so no window is monopolised by one city.
        // Within each window, events are spread with minimum 4-week gaps.
        const eligibleCities = findCitiesWithVenues(nationId, template, circuitLevel, venueMap)

        const cityFreqs: Array<{ cityId: string; freq: number }> = []
        for (const cityId of eligibleCities) {
          const cityData = cityLookup.get(cityId)
          const cityFreq = cityData?.eventHostingFrequency?.regional_tournament
          const freq = cityFreq !== undefined
            ? rng.nextInt(cityFreq.min, cityFreq.max)
            : 0
          if (freq > 0) cityFreqs.push({ cityId, freq })
        }

        const total = cityFreqs.reduce((sum, cf) => sum + cf.freq, 0)
        if (total === 0) continue

        const minGap = calendarRules?.regionalOpen.minWeeksBetweenEvents ?? 4
        const windows = calendarRules?.regionalOpen.windows

        if (windows !== undefined && windows.length > 0) {
          // Distribute events evenly across seasonal windows.
          // If total is odd, the first window gets the extra slot.
          const eventsPerWindow = windows.map((_, i) => {
            const base = Math.floor(total / windows.length)
            return base + (i < total % windows.length ? 1 : 0)
          })

          // Build a slot pool for each window independently.
          const windowSlotPools = windows.map((w, i) =>
            buildSeasonSlots(w.months, eventsPerWindow[i] ?? 0, minGap, weekFloor, rng),
          )

          // Assign interleaved cities to windows round-robin.
          const interleaved = interleaveCity(cityFreqs)
          const windowCounters = windows.map(() => 0)

          for (let i = 0; i < interleaved.length; i++) {
            const entry = interleaved[i]
            if (entry === undefined) continue

            const windowIdx = i % windows.length
            const counterIdx = windowCounters[windowIdx] ?? 0
            const week = windowSlotPools[windowIdx]?.[counterIdx]
            if (week === undefined) continue
            windowCounters[windowIdx] = counterIdx + 1

            const cityShort = cityShortId(entry.cityId)
            const venue = pickVenue(template, circuitLevel, cityShort, venueMap, rng)
            const weightClasses = pickWeightClasses(template, allWeightClasses, rng)
            const name = generateEventName(template, entry.cityId, venue.id, year, nationId, data, venueMap, usedNames)

            events.push({
              id: makeEventId(template.id, entry.cityId, year, week),
              templateId: template.id,
              circuitLevel,
              name,
              label: template.label,
              venueId: venue.id,
              venueName: venue.name,
              venueCapacity: venue.capacity,
              cityId: entry.cityId,
              nationId,
              year,
              week,
              weightClasses,
              status: 'scheduled',
              boutIds: [],
            })
          }
        } else {
          // No windows defined — fall back to spreading across typicalMonths
          const slots = buildSeasonSlots(template.typicalMonths, total, minGap, weekFloor, rng)
          const interleaved = interleaveCity(cityFreqs)

          for (let i = 0; i < interleaved.length && i < slots.length; i++) {
            const entry = interleaved[i]
            const week = slots[i]
            if (entry === undefined || week === undefined) continue

            const cityShort = cityShortId(entry.cityId)
            const venue = pickVenue(template, circuitLevel, cityShort, venueMap, rng)
            const weightClasses = pickWeightClasses(template, allWeightClasses, rng)
            const name = generateEventName(template, entry.cityId, venue.id, year, nationId, data, venueMap, usedNames)

            events.push({
              id: makeEventId(template.id, entry.cityId, year, week),
              templateId: template.id,
              circuitLevel,
              name,
              label: template.label,
              venueId: venue.id,
              venueName: venue.name,
              venueCapacity: venue.capacity,
              cityId: entry.cityId,
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
  allWeightClasses: WeightClass[],
  config: GameConfig,
  yearsToGenerate: number[],
  venueMap: Map<string, Venue>,
  occupiedMajorWeeks: Set<string>,
  rng: RNG,
  usedNames: Set<string>,
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

      // International events use venue.city and venue.country as direct display values.
      // No mapping to game city ids — international venues are not part of the city graph.
      const nationId = config.renderedNations[0] ?? 'international'

      if (MAJOR_LEVELS.has(circuitLevel) && occupiedMajorWeeks.has(weekKey)) {
        // Try adjacent weeks to avoid collision before giving up.
        const alt = week < 52 ? week + 1 : week - 1
        const altKey = `${year}-${alt}`
        if (occupiedMajorWeeks.has(altKey)) continue
        occupiedMajorWeeks.add(altKey)
        const venue = pickVenue(template, circuitLevel, null, venueMap, rng)
        const weightClasses = pickWeightClasses(template, allWeightClasses, rng)
        const name = generateEventName(template, venue.city, venue.id, year, nationId, data, venueMap, usedNames)
        events.push({
          id: makeEventId(template.id, nationId, year, alt),
          templateId: template.id,
          circuitLevel,
          name,
          label: template.label,
          venueId: venue.id,
          venueName: venue.name,
          venueCapacity: venue.capacity,
          cityId: venue.city,
          countryDisplay: venue.country,
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
      const weightClasses = pickWeightClasses(template, allWeightClasses, rng)
      const name = generateEventName(template, venue.city, venue.id, year, nationId, data, venueMap, usedNames)

      events.push({
        id: makeEventId(template.id, nationId, year, week),
        templateId: template.id,
        circuitLevel,
        name,
        label: template.label,
        venueId: venue.id,
        venueName: venue.name,
        venueCapacity: venue.capacity,
        cityId: venue.city,
        countryDisplay: venue.country,
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

// buildSeasonSlots spreads `count` week slots evenly across the given months.
// The available weeks are collected, sorted, then divided into `count` equal sections.
// One week is picked randomly within each section, so events are distributed
// throughout the season rather than clustered at its start.
// minGap enforces a lower bound between consecutive slots within the same section pass.
// Slots before weekFloor are excluded (current-year truncation).
function buildSeasonSlots(
  months: number[],
  count: number,
  minGap: number,
  weekFloor: number,
  rng: RNG,
): number[] {
  if (count <= 0 || months.length === 0) return []

  // Collect all weeks belonging to the given months, sorted ascending.
  // Set deduplicates in case month ranges overlap.
  const seen = new Set<number>()
  for (const month of months) {
    const [lo, hi] = MONTH_WEEK_RANGES[month] ?? [1, 52]
    for (let w = lo; w <= hi; w++) {
      if (w >= weekFloor) seen.add(w)
    }
  }
  const available = Array.from(seen).sort((a, b) => a - b)

  if (available.length === 0) return []

  // Cap count so we never try to fit more events than the season allows with minGap spacing.
  const maxFeasible = Math.floor((available.length + minGap - 1) / minGap)
  const actual = Math.min(count, maxFeasible)

  // Divide available weeks into `actual` equal sections.
  // Picking one week per section guarantees events spread across the whole season.
  const sectionSize = available.length / actual
  const slots: number[] = []

  for (let i = 0; i < actual; i++) {
    const lo = Math.floor(i * sectionSize)
    const hi = Math.min(Math.floor((i + 1) * sectionSize) - 1, available.length - 1)
    const pickIdx = lo <= hi ? rng.nextInt(lo, hi) : lo
    const candidate = available[pickIdx] ?? available[lo] ?? available[0]
    if (candidate === undefined) continue

    // Enforce minimum gap from the previous slot to prevent adjacent-week clustering
    // within a single section (can happen when sectionSize ≈ minGap).
    const prev = slots.length > 0 ? slots[slots.length - 1]! : -Infinity
    const week = Math.max(candidate, prev + minGap)

    if (week <= 52) slots.push(week)
  }

  return slots
}

// interleaveCity builds an ordered list of city assignments for a set of events.
// Cities are interleaved round-robin by event index rather than grouped —
// so Riga's two events land in different sections of the season slot pool
// rather than back-to-back. This is the mechanism that prevents one city
// from monopolising the start or end of the year.
function interleaveCity(
  cityFreqs: ReadonlyArray<{ readonly cityId: string; readonly freq: number }>,
): Array<{ cityId: string }> {
  const maxFreq = cityFreqs.reduce((m, cf) => Math.max(m, cf.freq), 0)
  const result: Array<{ cityId: string }> = []
  for (let i = 0; i < maxFreq; i++) {
    for (const cf of cityFreqs) {
      if (i < cf.freq) result.push({ cityId: cf.cityId })
    }
  }
  return result
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
  // usedNames tracks all event names assigned in this generation pass.
  // Shared across domestic and international events — names include the year
  // so a single flat set covers the full generation window without key collisions.
  const usedNames = new Set<string>()
  const allEvents: CalendarEvent[] = []

  // Domestic events for each rendered nation that has boxing data.
  for (const nationId of config.renderedNations) {
    const bundle = data.nations[nationId]
    if (bundle === undefined || bundle.boxing === undefined) continue

    const domestic = generateDomesticEvents(
      nationId,
      bundle.boxing,
      bundle.cities,
      data.weightClasses.weightClasses,
      startYear,
      startWeek,
      yearsToGenerate,
      venueMap,
      occupiedMajorWeeks,
      worldState,
      rng,
      data,
      usedNames,
    )
    allEvents.push(...domestic)
  }

  // International events (Baltic, European, World, Olympics).
  const international = generateInternationalEvents(
    data,
    data.weightClasses.weightClasses,
    config,
    yearsToGenerate,
    venueMap,
    occupiedMajorWeeks,
    rng,
    usedNames,
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
