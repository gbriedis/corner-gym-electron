# Current Task

## Task: Calendar QoL + Sanctioning Body Page + Venue Page + Event Full Page

### What To Build
A collection of calendar quality of life improvements, three new dedicated pages (sanctioning body, venue, event full detail), and the regional tournament multi-day fix. Read all parts before starting — some share components.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`

---

## Part 1 — Data Fix

### Fix `nations/latvia/boxing/amateur-circuit.json`

`regional_tournament` must NOT be multi-day:
```json
{
  "id": "regional_tournament",
  "multiDay": false
}
```

Remove `daysStructure` from `regional_tournament` entirely if present. Only `national_championship` and above have `multiDay: true`.

Update calendar generation and UI — regional tournament detail panel shows "Single Day Tournament · Single Elimination" not a day schedule.

---

## Part 2 — Calendar QoL Fixes

### 2a — Day Cell Colour Split

When a day has events, the day cell background changes colour — no longer neutral. The cell background splits equally between the circuit level colours of events on that day.

- 1 event: full cell background in that circuit level's colour at 20% opacity
- 2 events: cell split 50/50 vertically, each half in its circuit level colour at 20% opacity
- 3 events: cell split 33/33/33 vertically
- 4+ events: split equally

The split is a CSS gradient or flexbox column of coloured strips behind the day number and event pills. The day number stays visible on top. The cell becomes clearly clickable — the whole cell is the target, not just the small pill.

Circuit level colours for cell backgrounds (20% opacity versions of badge colours):
- `club_card` → `--color-bg-mid` tint
- `regional_tournament` → `--color-accent-blue` at 20%
- `national_championship` → `--color-accent-amber` at 20%
- `baltic_championship` → `--color-accent-green` at 20%
- `european_championship` → `--color-accent-blue-dark` at 20%
- `world_championship` → `--color-accent-gold` at 20%
- `olympics` → gold gradient at 20%

---

### 2b — Invisible Scrollbar

Apply to all scrollable areas in the calendar and upcoming events panel.

```css
/* Thin, barely visible scrollbar — functional but unobtrusive */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { 
  background: var(--color-bg-mid); 
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover { 
  background: var(--color-text-muted); 
}
```

Apply globally in `theme.css`. Works in Electron/Chromium.

---

### 2c — Click Outside to Close 75/25 Panel

The 75/25 event quick view closes when the user clicks anywhere outside the right panel — on the calendar grid, on empty space, anywhere that is not the panel itself.

Use a transparent overlay behind the panel that captures clicks:
```typescript
// Clicking the overlay closes the panel.
// The overlay sits behind the panel but in front of the calendar grid.
// This prevents accidental clicks on calendar events while panel is open.
{selectedEvent && (
  <div 
    className="overlay" 
    onClick={() => setSelectedEvent(null)} 
  />
)}
```

Escape key also closes the panel (already exists — verify it still works).

---

### 2d — Calendar Navigation Limit

User cannot navigate past the last month that has generated events.

Calculate `maxNavigableMonth` from the furthest event in the calendar data. Disable the "next month" arrow when `viewMonth/viewYear` would exceed this. Arrow visually dims when disabled — `opacity: 0.3`, `cursor: not-allowed`.

Show a small note when at the limit: "Calendar generated to [Month Year]" in muted text below the navigation arrows.

---

### 2e — Olympics Future Landmark

Olympics is beyond the generation window so it never appears in the grid. But the user should know it exists as a goal.

In the right sidebar (upcoming events panel), below the list of upcoming events, add a "Future Landmarks" section. This shows events that are scheduled beyond the generation window — pulled from `international/boxing/circuits.json` `nextOccurrence` field.

```
Future Landmarks
━━━━━━━━━━━━━━━━
🥇 Olympics 2028
   Paris · Summer 2028
   Selection via federation
   
🌍 World Championships 2027
   Location TBD · 2027
```

Olympics gets the gold treatment — gold text, medal emoji. Clicking a landmark shows a small tooltip or inline expansion: what the event is, how to qualify, why it matters.

These are not calendar events — they're aspirational markers pulled directly from circuit data.

---

### 2f — Upcoming Events Panel Name Fix

The upcoming events sidebar still shows "Club Tournament" in some places. Update all display labels to use the new circuit level display names:
- `club_card` → "Club Card"
- `regional_tournament` → "Regional"

Audit every place circuit level ids are converted to display strings and ensure consistency.

---

### 2g — Sanctioning Body as Hyperlink Style

Anywhere a sanctioning body name appears (event detail panel, upcoming events) — it renders as a text link, not a button. Styling:
- Normal state: `--color-text-primary`, no underline
- Hover state: underline appears, cursor pointer
- Clicking navigates to `/sanctioning-body/:bodyId`

Same treatment for venue names — hover underline, click navigates to `/venue/:venueId`.

---

## Part 3 — Sanctioning Body Page

**Route:** `/sanctioning-body/:bodyId`

**Data source:** `nations/latvia/boxing/lbf-rules.json`, `international/boxing/sanctioning-bodies.json`

**Layout:** Full screen, back button top left returns to previous page.

**Sections:**

**Header:**
- Body name large, in `--font-body` uppercase
- Level badge (National / Continental / International)
- Affiliation — "Affiliated with [EUBC]" as a link if applicable

**About:**
- Description from `sanctioning-bodies.json`
- Jurisdiction — what nations/regions they govern

**Competition Rules:**
- Table of rules per circuit level — round limits, scoring system, headgear, glove weight, max bouts per day
- Grouped by age category (Junior / Youth / Senior tabs or sections)
- Pulled from the relevant rules JSON file

**Titles Controlled:**
- List of title belts this body awards per weight class
- Each weight class as a row

**Governed Events:**
- List of circuit levels this body sanctions
- Each as a card linking to... nothing yet (event history comes later)

---

## Part 4 — Venue Page

**Route:** `/venue/:venueId`

**Data source:** `nations/latvia/boxing/venues.json`, `international/boxing/venues.json`, `calendar_events` SQLite table

**Layout:** Full screen, back button returns to previous page.

**Sections:**

**Header:**
- Venue image — full width, 21:9 ratio, graceful fallback
- Venue name overlaid bottom-left on the image in large `--font-body` text
- City · Country · Capacity on the line below

**About:**
- Description from venues JSON
- Capacity with seat icon
- `eligibleFor` — which circuit levels this venue hosts, shown as badges

**Upcoming Events Here:**
- Query `calendar_events` by `venueId` where `status = 'scheduled'` and `year/week >= current`
- Show as a compact list: date, event name, circuit badge
- Empty state: "No upcoming events scheduled at this venue"

**Past Events Here:**
- Query `calendar_events` by `venueId` where `status = 'completed'`
- Show as a compact list: date, event name, result summary (winner if available)
- Empty state: "No recorded events yet" — this will fill as the game progresses

---

## Part 5 — Event Full Detail Page

**Route:** `/calendar/event/:eventId`

**Navigated to from:** "View Full Details →" button in the 75/25 quick view panel.

**Layout:** Full screen, back button returns to calendar at the same month.

**Sections:**

**Header:**
- Event name large
- Circuit level badge, format indicator, date range (multi-day shows full date span)
- Venue name as a link → venue page

**Venue Feature:**
- Venue image 21:9
- Venue name, city, country, capacity
- Link to full venue page

**About This Event:**
- Description pulled from event template description
- Sanctioning body as a link → sanctioning body page
- Round rules for this circuit level + senior age category (rounds, duration, scoring)
- Selection method note if federation_selection

**For Multi-Day Events — Competition Schedule:**
- Day by day breakdown (already exists in 75/25 — expanded version here)
- Each day shows date, round label, and eventually fighters per bout

**Bracket Section (placeholder for now):**
- Header: "Tournament Bracket"
- If `status = 'open'`: "Bracket will be drawn when entry closes — [X weeks before event]"
- If `status = 'closed'` or beyond: show bracket structure (empty for now — fighters entered later)
- Note: "Enter a fighter via the Fighters screen once your roster is set up"

**History Section:**
- "Past editions of this event" — query calendar_events by templateId where status = 'completed'
- Show as list: year, host city, venue
- Empty state: "No previous editions recorded" — fills as game progresses

**Why This Event Matters:**
- For each circuit level, a short paragraph explaining the significance
- `club_card`: "A local card. One bout, go home. The starting point."
- `regional_tournament`: "First real tournament experience. Fighters advance through a bracket in a single day."
- `national_championship`: "The Latvian title. The ceiling of domestic amateur boxing and the gateway to international selection."
- `baltic_championship`: "Latvia, Lithuania, Estonia. Regional prestige."
- `european_championship`: "The highest level most Latvian fighters will ever compete at."
- `world_championship`: "World amateur title. Reached by very few."
- `olympics`: "Every four years. The pinnacle. Selection via federation qualification. This is what everything points toward."

Olympics "Why This Event Matters" gets the full gold treatment — gold text, larger font, the weight of it should be felt.

---

## Part 6 — Routing Update

**Update `packages/ui/src/App.tsx`**

Add three new routes:
```typescript
/sanctioning-body/:bodyId    → SanctioningBodyPage
/venue/:venueId              → VenuePage  
/calendar/event/:eventId     → EventFullPage
```

All three pages need access to `gameData` (the loaded JSON data) and `saveId` (for SQLite queries). Pass via Zustand store or React context — do not prop drill.

**Update `packages/ui/src/store/gameStore.ts`**

Add `gameData: GameData | null` to the store if not already present. Calendar pages need access to the raw JSON data (venue descriptions, sanctioning body rules etc) without IPC round trips for static data.

---

### Definition Of Done
- [ ] `regional_tournament` — `multiDay: false`, no day schedule in detail panel
- [ ] Day cell colour split — cells background-tinted by event circuit colours
- [ ] Invisible scrollbar applied globally
- [ ] Click outside closes 75/25 panel
- [ ] Calendar navigation capped at last generated event month
- [ ] Future Landmarks section in sidebar — Olympics and World Championships
- [ ] Upcoming events panel shows "Club Card" not "Club Tournament"
- [ ] Sanctioning body names render as hover-underline links
- [ ] Venue names render as hover-underline links
- [ ] Sanctioning body page — rules table, titles, governed events
- [ ] Venue page — image, description, upcoming/past events from SQLite
- [ ] Event full page — accessible from 75/25 "View Full Details" button
- [ ] Event full page — venue image, bracket placeholder, history, why it matters
- [ ] Olympics "Why It Matters" has gold treatment
- [ ] Three new routes registered in App.tsx
- [ ] `gameData` accessible in store for new pages
- [ ] `pnpm dev` — all three pages navigate correctly
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing
- [ ] `docs/structure.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: calendar qol + sanctioning body + venue + event pages`

### Notes
- Venue and sanctioning body links are text links not buttons — hover underline only
- Overlay for click-outside must sit behind the panel but in front of the calendar
- Future Landmarks are not calendar events — pulled from circuit data nextOccurrence
- All SQLite queries for past/upcoming events use saveId from the store
- Empty states on history sections are expected — they fill as the game progresses
- "View Full Details" button in 75/25 panel navigates to /calendar/event/:eventId
- Back navigation must return to calendar at the same month — store current month/year in URL params or store
