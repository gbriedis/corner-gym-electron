// Types for all boxing infrastructure data files.
// Covers: sanctioning-bodies.json (domestic + international),
// amateur-circuit.json, international/boxing/circuits.json,
// event-templates.json (domestic + international),
// venues.json (domestic + international)

import type { Meta } from './meta.js'

export type CircuitLevel =
  | 'club_card'              // was club_tournament
  | 'regional_tournament'    // was regional_open
  | 'national_championship'
  | 'golden_gloves'          // USA-specific prestige amateur tournament
  | 'baltic_championship'
  | 'european_championship'
  | 'world_championship'
  | 'olympics'

export type EventFormat = 'tournament_bracket' | 'card'
export type LocationScope = 'city' | 'regional' | 'national' | 'international'
export type SelectionMethod = 'open' | 'federation_selection'
export type BodyLevel = 'national' | 'continental' | 'international'

export interface RankingSystem {
  id: string
  description: string
  resetMonth: number | null
}

// calendarRules on a national sanctioning body defines when and how often domestic
// events may be scheduled. The engine reads this to drive nation-level slot distribution
// rather than per-city round-robin, which would cluster all events at the start of
// typicalMonths. Only national bodies need calendar rules; continental/international
// bodies schedule events through the international circuits data.
export interface ClubTournamentRules {
  minWeeksBetweenEvents: number
}

export interface RegionalOpenWindow {
  months: number[]
  label: string
}

export interface RegionalOpenRules {
  minWeeksBetweenEvents: number
  windows: RegionalOpenWindow[]
}

export interface NationalCalendarRules {
  // Months that make up the competition season — events only land in these months.
  // Ordered list, can span the year boundary (e.g. [9,10,11,1,2,3,4,5]).
  competitionSeasonMonths: number[]
  clubTournament: ClubTournamentRules
  regionalOpen: RegionalOpenRules
}

export interface SanctioningBody {
  id: string
  label: string
  level: BodyLevel
  affiliation: string | null
  description: string
  titlesPerWeightClass: string[]
  rankingSystem: RankingSystem
  calendarRules?: NationalCalendarRules
}

// JSON top-level key: "sanctioningBodies"
export interface SanctioningBodiesData {
  meta: Meta
  sanctioningBodies: SanctioningBody[]
}

export interface EventDay {
  day: number
  label: string
  roundNumber: number
}

export interface CircuitLevelDefinition {
  id: CircuitLevel
  label: string
  prestige: number
  sanctioningBody: string
  format: EventFormat
  typicalMonths: number[]
  locationScope: LocationScope
  minimumBouts: number
  // Domestic circuits use frequencyPerYear; international circuits use frequencyYears.
  frequencyPerYear?: number
  frequencyYears?: number
  nextOccurrence?: number
  selectionMethod?: SelectionMethod
  participatingNations?: string[] | 'all'
  multiDay?: boolean
  daysStructure?: EventDay[]
  description: string
}

// JSON top-level key: "circuitLevels"
export interface AmateurCircuitData {
  meta: Meta
  circuitLevels: CircuitLevelDefinition[]
}

// JSON top-level key: "circuitLevels"
export interface InternationalCircuitsData {
  meta: Meta
  circuitLevels: CircuitLevelDefinition[]
}

// Bout count only requires a minimum — event size is bounded by entrant count,
// not an arbitrary cap. max is kept optional for forward compatibility.
export interface BoutCountRange {
  min: number
  max?: number
}

export interface WeightClassRange {
  min: number
  max: number
}

// frequencyPerYear can be a fixed number (national_championship: 1)
// or a range when the organiser count varies (club_card: { min: 4, max: 8 }).
export interface FrequencyRange {
  min: number
  max: number
}

export interface EventTemplate {
  id: string
  circuitLevel: CircuitLevel
  label: string
  boutCount: BoutCountRange
  weightClassCount: number | WeightClassRange
  locationScope: LocationScope
  // Domestic templates use frequencyPerYear; international templates use frequencyYears.
  frequencyPerYear?: number | FrequencyRange
  frequencyYears?: number
  typicalMonths: number[]
  hostCityRotation?: string[]
  venuePool?: string[]
  description: string
}

// JSON top-level key: "eventTemplates"
export interface EventTemplatesData {
  meta: Meta
  eventTemplates: EventTemplate[]
}

export interface Venue {
  id: string
  name: string
  formerName?: string
  city: string
  country: string
  capacity: number
  description: string
  eligibleFor: CircuitLevel[]
}

// JSON top-level key: "venues"
export interface VenuesData {
  meta: Meta
  venues: Venue[]
}
