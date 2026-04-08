// CalendarEvent is a generated event instance — a real date, a real venue,
// a real set of weight classes. It is produced by the calendar generation system
// reading EventTemplates and placing them on the timeline.
// CalendarEvents are stored in SQLite and retrieved by the UI and simulation systems.

import type { CircuitLevel } from './data/boxing.js'

export type EventStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export interface CalendarEvent {
  id: string
  templateId: string
  circuitLevel: CircuitLevel
  label: string
  venueId: string
  venueName: string
  venueCapacity: number
  // For domestic events: the full city id (e.g. "latvia-riga").
  // For international events: venue.city display string (e.g. "london").
  cityId: string
  // Only set on international events — venue.country display string (e.g. "england").
  countryDisplay?: string
  nationId: string
  year: number
  week: number       // ISO week number 1–52
  weightClasses: string[]
  status: EventStatus
  boutIds: string[]  // populated when event runs — empty when scheduled
}

export interface CalendarData {
  events: CalendarEvent[]
}
