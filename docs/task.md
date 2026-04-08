# Current Task

## Task: Calendar Generation — Types + Event Generation Engine

### What To Build
TypeScript types for all boxing infrastructure data files, then the calendar generation system. The engine reads event templates and populates a real boxing calendar. Events exist in the world whether your fighters are on them or not.

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## Part 1 — TypeScript Types

All type files go in `packages/engine/src/types/data/`.

---

**`src/types/data/boxing.ts`**

Covers all boxing infrastructure files. One file — boxing data types are tightly related.

```typescript
// Covers: sanctioning-bodies.json (both domestic and international),
// amateur-circuit.json, international/boxing/circuits.json,
// event-templates.json (both domestic and international),
// venues.json (both domestic and international)

export type CircuitLevel =
  | 'club_tournament'
  | 'regional_open'
  | 'national_championship'
  | 'baltic_championship'
  | 'european_championship'
  | 'world_championship'
  | 'olympics'

export type EventFormat = 'tournament_bracket' | 'card'
export type LocationScope = 'city' | 'regional' | 'national' | 'international'
export type SelectionMethod = 'open' | 'federation_selection'
export type BodyLevel = 'national' | 'continental' | 'international'

export interface SanctioningBody {
  id: string
  label: string
  level: BodyLevel
  affiliation: string | null
  description: string
  titlesPerWeightClass: string[]
  rankingSystem: string
}

export interface SanctioningBodiesData {
  meta: Meta
  bodies: SanctioningBody[]
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
  frequencyPerYear?: number
  frequencyYears?: number
  nextOccurrence?: number
  selectionMethod?: SelectionMethod
  participatingNations?: string[] | 'all'
  description: string
}

export interface AmateurCircuitData {
  meta: Meta
  levels: CircuitLevelDefinition[]
}

export interface InternationalCircuitsData {
  meta: Meta
  levels: CircuitLevelDefinition[]
}

export interface BoutCountRange {
  min: number
  max: number
}

export interface EventTemplate {
  id: string
  circuitLevel: CircuitLevel
  label: string
  boutCount: BoutCountRange
  weightClassCount: number | BoutCountRange
  locationScope: LocationScope
  frequencyPerYear?: number
  frequencyYears?: number
  typicalMonths: number[]
  hostCityRotation?: string[]
  venuePool?: string[]
  description: string
}

export interface EventTemplatesData {
  meta: Meta
  templates: EventTemplate[]
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

export interface VenuesData {
  meta: Meta
  venues: Venue[]
}
```

Add to `src/types/data/index.ts`.

---

**`src/types/calendar.ts`** (not a data type — goes in `src/types/`)

The generated calendar event — what the engine produces when it reads a template and creates a real event.

```typescript
// A CalendarEvent is a generated event instance — a real date, a real venue,
// a real set of weight classes. It is produced by the calendar generation system
// reading EventTemplates and placing them on the timeline.
// CalendarEvents are stored in SQLite and retrieved by the UI and simulation systems.

export type EventStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export interface CalendarEvent {
  id: string
  templateId: string
  circuitLevel: CircuitLevel
  label: string
  venueId: string
  cityId: string
  nationId: string
  year: number
  week: number        // ISO week number 1-52
  weightClasses: string[]
  status: EventStatus
  boutIds: string[]   // populated when event runs — empty when scheduled
}

export interface CalendarData {
  events: CalendarEvent[]
}
```

---

## Part 2 — Update Loader

**Update `packages/engine/src/data/loader.ts`**

Add boxing infrastructure files to `GameData`. The loader dynamically scans `nations/[id]/boxing/` for each loaded nation bundle — same dynamic pattern as the nation loader.

```typescript
// NationBundle gets a boxing section
export interface NationBoxingData {
  sanctioningBodies: SanctioningBodiesData
  amateurCircuit: AmateurCircuitData
  eventTemplates: EventTemplatesData
  venues: VenuesData
}

// GameData gets international boxing
export interface InternationalData {
  boxing: {
    sanctioningBodies: SanctioningBodiesData
    circuits: InternationalCircuitsData
    eventTemplates: EventTemplatesData
    venues: VenuesData
  }
}

// GameData updated
export interface GameData {
  // ... existing fields ...
  international: InternationalData
  // NationBundle gets boxing?: NationBoxingData
  // Boxing is optional on NationBundle — not every nation has boxing data yet
}
```

The loader checks if `nations/[id]/boxing/` exists before loading — if the folder doesn't exist, `boxing` is undefined on that nation bundle. No hard error for missing boxing data — nations can exist without a boxing scene.

---

## Part 3 — Calendar Generation

**`packages/engine/src/generation/calendar.ts`**

```typescript
// generateCalendar produces a list of CalendarEvents for a given year range.
// It reads EventTemplates from both the nation bundle and international data,
// places events on the calendar respecting real timing constraints,
// and assigns venues from the eligible pool.
//
// Calendar generation rules:
// 1. Game starts mid-year — generate remainder of start year + full next year
// 2. Every January 1st in simulation — generate the new full year
// 3. National championship always in November — never deviate from typicalMonths
// 4. Olympics and World Championship respect frequencyYears and nextOccurrence
// 5. Host city rotation for national championship tracks current index in world state
// 6. No two major events (national_championship or above) in the same week
// 7. Club tournaments and regional opens can overlap — they're in different cities

export function generateCalendar(
  startYear: number,
  startWeek: number,
  config: GameConfig,
  data: GameData,
  rng: RNG
): CalendarEvent[]
```

**Generation logic per template:**

For `frequencyPerYear` templates — distribute events across `typicalMonths` evenly, randomise the specific week within each month using RNG.

For `frequencyYears` templates — check `nextOccurrence`. If it falls within the generation window, place it in the correct month. Use RNG for the specific week.

For `hostCityRotation` — read current rotation index from world state, pick that city, increment index (wrap to 0 after last entry). Store updated index back to world state.

Venue assignment — filter `venues` by `eligibleFor` containing the event's `circuitLevel` and `city` matching the assigned city. Pick randomly from eligible pool using RNG. If no eligible venue found — throw descriptive error.

---

**`packages/engine/src/generation/calendar.test.ts`**

Tests:
- National championship always lands in November (weeks 44-48)
- Olympics only generated in Olympic years
- No two national_championship+ events in same week
- Same seed + config = same calendar every time
- Host city rotation increments correctly and wraps
- Venue assigned always eligible for that circuit level
- Calendar for 2026 mid-year start contains remainder of 2026 + full 2027
- January 1st trigger generates new full year

---

## Part 4 — SQLite Calendar Table

**Update `packages/desktop/src/db.ts`**

Add calendar table:

```sql
CREATE TABLE calendar_events (
  id TEXT NOT NULL,
  saveId TEXT NOT NULL,
  templateId TEXT NOT NULL,
  circuitLevel TEXT NOT NULL,
  label TEXT NOT NULL,
  venueId TEXT NOT NULL,
  cityId TEXT NOT NULL,
  nationId TEXT NOT NULL,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  weightClasses TEXT NOT NULL,  -- JSON array serialised
  status TEXT NOT NULL DEFAULT 'scheduled',
  boutIds TEXT NOT NULL DEFAULT '[]',  -- JSON array serialised
  PRIMARY KEY (id, saveId),
  FOREIGN KEY (saveId) REFERENCES saves(id)
);
```

Export typed functions:
```typescript
export function saveCalendar(db: Database, saveId: string, events: CalendarEvent[]): void
export function loadCalendar(db: Database, saveId: string): CalendarEvent[]
export function getUpcomingEvents(db: Database, saveId: string, currentWeek: number, currentYear: number, weeksAhead: number): CalendarEvent[]
export function updateEventStatus(db: Database, saveId: string, eventId: string, status: EventStatus): void
```

---

## Part 5 — Wire Into World Generation

**Update `packages/engine/src/generation/world.ts`**

After generating persons and gyms, call `generateCalendar()` and include the result.

Update `generateWorld()` return type:
```typescript
export function generateWorld(config: GameConfig, data: GameData): {
  worldState: WorldState
  persons: Person[]
  calendar: CalendarEvent[]
}
```

Update `packages/desktop/src/ipc.ts` generate-and-save handler to also call `saveCalendar()` after world generation.

---

### Definition Of Done
- [ ] `src/types/data/boxing.ts` — all interfaces, exported from index
- [ ] `src/types/calendar.ts` — CalendarEvent, CalendarData, EventStatus
- [ ] `loader.ts` — international boxing loaded, nation boxing loaded dynamically
- [ ] `src/generation/calendar.ts` — generates correct calendar from templates
- [ ] `src/generation/calendar.test.ts` — all tests passing
- [ ] SQLite `calendar_events` table created
- [ ] db.ts — saveCalendar, loadCalendar, getUpcomingEvents, updateEventStatus
- [ ] `generateWorld()` returns calendar, IPC saves it
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: calendar generation — types, engine, sqlite`

### Notes
- Read engine skill fully before writing any code
- Week numbers are ISO week numbers 1-52
- RNG must be used for all randomness — no Math.random()
- National championship ALWAYS in November — this is a hard constraint not a soft one
- Olympics 2028, European Championships 2026 and 2028, World Championships 2027 — these are the next real occurrences
- Boxing data is optional on NationBundle — loader does not error if boxing folder missing
- Comment why on every non-obvious calendar placement decision

---

## Part 6 — Radix Icons

**Install Radix Icons**

```bash
pnpm --filter @corner-gym/ui add @radix-ui/react-icons
```

Create `packages/ui/src/components/Icon.tsx` — a thin wrapper around Radix icons that applies theme colours and sizes consistently.

```typescript
// Icon.tsx wraps @radix-ui/react-icons with consistent sizing and colour.
// Always import icons through this wrapper — never use Radix icons directly in screens.
// This keeps icon usage consistent and makes swapping the icon library trivial.

import type { IconProps } from '@radix-ui/react-icons/dist/types'

type IconSize = 'sm' | 'md' | 'lg'

interface Props {
  icon: React.ForwardRefExoticComponent<IconProps>
  size?: IconSize
  color?: string  // CSS variable string e.g. 'var(--color-accent-amber)'
}
```

Size map: sm = 14px, md = 16px, lg = 20px.

---

## Part 7 — Calendar Screen + SideNav Icons

**Update `packages/ui/src/components/layout/SideNav.tsx`**

Add Radix icons to nav items. Use Icon wrapper component.

Nav items with icons:
- Gym → `HomeIcon`
- Fighters → `PersonIcon`
- Inbox → `EnvelopeClosedIcon`
- World → `GlobeIcon`
- Finances → `BarChartIcon`
- Calendar → `CalendarIcon`

Active item: icon colour `var(--color-accent-amber)`. Inactive: `var(--color-text-muted)`.

---

**`packages/ui/src/screens/Calendar.tsx`**

New screen. Shows upcoming boxing events from the calendar.

IPC call needed — add to `packages/desktop/src/ipc.ts`:
```typescript
ipcMain.handle('get-upcoming-events', async (_, saveId: string, currentWeek: number, currentYear: number) => {
  return getUpcomingEvents(db, saveId, currentWeek, currentYear, 52) // full year ahead
})
```

Add to `packages/ui/src/ipc/client.ts`:
```typescript
export async function getUpcomingEvents(saveId: string, currentWeek: number, currentYear: number): Promise<CalendarEvent[]>
```

**Calendar screen layout:**

Header: "Boxing Calendar" title, current year displayed.

Events grouped by month. Each month is a section with the month name as a header.

Each event card shows:
- Event name
- Circuit level as a Badge component (club_tournament → muted, regional_open → blue, national_championship → amber, baltic+ → gold)
- Venue name and city
- Week number translated to approximate date range
- Status badge (scheduled → muted, in_progress → green, completed → text-muted)

Use `CalendarIcon` from Radix in the header. Use `MapPinIcon` next to venue. Use `ClockIcon` next to date.

Empty state if no events: centred message "No events scheduled." in muted text.

**Wire Calendar screen into GameShell** — add it to SideNav and routing. Calendar screen is visible from game start.

---

### Updated Definition Of Done
- [ ] All previous done criteria
- [ ] `@radix-ui/react-icons` installed
- [ ] `Icon.tsx` wrapper component created
- [ ] SideNav updated with icons for all nav items
- [ ] `get-upcoming-events` IPC handler added
- [ ] `Calendar.tsx` screen created — events grouped by month, correct badges, icons
- [ ] Calendar linked in SideNav and GameShell routing
- [ ] `pnpm dev` — calendar screen shows real generated events from the save
- [ ] Committed: `feat: calendar generation — types, engine, sqlite, calendar screen`
