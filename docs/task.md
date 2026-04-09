# Current Task

## Task: Top Nav Rework + Calendar Events + Page v2 + Bracket Component

### What To Build
Four things in sequence. Each builds on the previous.
1. Top nav — spine of the game UI
2. Calendar event display — replace pills with clean text in split cells
3. Page v2 — event, venue, sanctioning body pages redesigned around small images
4. Bracket component — single elimination skeleton

### Skill To Load
`.claude/skills/public/frontend-design/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## The Design Philosophy For This Task

The assets we have are small venue snapshots — cramped boxing gyms and clubs. They are texture, not heroes. The typography and layout carries the pages. Images accent, they do not lead.

Think print. Boxing programmes. Fight posters. Dense, considered, every element earning its place. This is a sim game played on a laptop — the UI should feel like a specialist tool used by someone who knows boxing, not a consumer app.

---

## Part 1 — Top Nav Rework

Completely replace the current top bar. Remove all per-page title headers from Calendar, Venue, Sanctioning Body, and Event pages — the top nav owns that responsibility now.

### Layout

Full width, fixed top, `--color-bg-dark` background, single pixel bottom border `--color-bg-mid`. Height: 48px. Three zones.

**Left zone (navigation memory):**
```
[←] [→]  CALENDAR
```
- Back arrow: `ArrowLeftIcon` from Radix, 16px, `--color-text-muted`. Disabled state: `opacity: 0.3`. Clicking navigates browser history back.
- Forward arrow: `ArrowRightIcon`, same treatment.
- Page name: current route label in Inconsolata, 11px, uppercase, tracked, `--color-text-muted`. Clicking navigates to `/` (Dashboard/main game screen).
- Separator between arrows and page name: single pixel vertical rule `--color-bg-mid`.

Page name map:
```
/              → DASHBOARD
/calendar      → CALENDAR
/calendar/event/:id  → EVENT
/venue/:id     → VENUE
/sanctioning-body/:id → FEDERATION
/fighters      → FIGHTERS
/inbox         → INBOX
/world         → WORLD
/finances      → FINANCES
```

**Centre zone:**
Empty for now. Reserved. `flex: 1`.

**Right zone (game state):**
```
Week 3, 2026    €  —    [ADVANCE WEEK]
```

- Date: `WEEK 3 · 2026` in Inconsolata, 11px, uppercase, tracked, `--color-text-muted`. Pulled from game store.
- Separator: single pixel vertical rule.
- Finances: `€ —` placeholder. Small, muted. Will be wired when finances are built.
- Separator: single pixel vertical rule.
- Advance Week button: `--color-accent-amber` background, dark text, Inconsolata, 11px, uppercase, tracked, `padding: 6px 16px`. No border radius beyond `--radius-sm`. This button is the heartbeat of the game — it should feel weighted and deliberate. Disabled state: `opacity: 0.5`. Not wired to logic yet — clicking does nothing but the skeleton exists.

### Remove From All Pages
- `Calendar.tsx` — remove "BOXING CALENDAR" header section
- `EventFullPage.tsx` — remove page title header (back button moves to top nav)
- `VenuePage.tsx` — remove page title header
- `SanctioningBodyPage.tsx` — remove page title header

Back buttons on detail pages — remove them. Navigation history arrows in top nav handle this.

---

## Part 2 — Calendar Event Display Rework

### Kill The Pills

Remove event pills from day cells entirely. The coloured cell split does the visual work. Inside each colour section, show only the event name as plain text.

### Day Cell Layout

Each day cell has:
- Day number top-right, small, muted
- If events: the cell background splits equally by event count (existing behaviour — keep)
- Inside each colour split section: event name in Inconsolata, 10px, `--color-text-primary`, single line, truncated with ellipsis if too long, `padding: 2px 4px`
- No badges, no pills, no icons inside the cell

The event name text sits in the lower portion of each split section. If the section is too narrow for text (less than 20px height), show nothing — the colour alone communicates.

### Empty Day Cells
No change — neutral background, day number only.

### Today Highlight
Current game week's days: day number in `--color-accent-amber`. Subtle, not loud.

### Legend
Keep the existing legend below the grid. Update labels to match new circuit level names: "Club Card", "Regional", "Nationals", etc.

---

## Part 3 — Page v2

### Design System For These Pages

**Image treatment:** Small, contained, right-aligned. Images are 240px wide maximum, aspect ratio 4:3, `object-fit: cover`. They float right in the header section while typography dominates the left. If no image — the layout works without it, no placeholder needed.

**Header section:** Two columns. Left: all text content. Right: image (if exists). Left column takes remaining space. Never reversed — text always left, image always right.

**Typography hierarchy:**
- Page title: Rock Bro, 28px, `--color-text-primary`
- Section labels: Inconsolata, 10px, uppercase, letter-spacing 0.15em, `--color-text-muted`
- Body text: Inconsolata, 13px, `--color-text-primary`, line-height 1.7
- Stat values: Inconsolata, 14px, `--color-text-primary`
- Stat labels: Inconsolata, 10px, uppercase, `--color-text-muted`

**Sections:** Separated by single pixel rules `--color-bg-mid`. Label above rule, content below. `padding: 16px 0` between sections.

**Stat grids:** 3-4 columns. Each stat: label (10px muted uppercase) above value (14px primary). Used for capacity, rounds, date, city etc.

**Lists:** No card wrappers. Rows separated by single pixel rules. Each row: date/label left, name centre, badge right. `padding: 8px 0`.

---

### Event Full Page v2 (`/calendar/event/:eventId`)

**Header:**
```
[Left column]                    [Right: 240px image]
CLUB CARD badge  · 17 Jan 2026
Club Tournament
Rīgas Boksa klubs  →link
```
- Circuit badge top-left
- Date small muted right of badge on same line
- Event name in Rock Bro, large
- Venue name as hover-underline link below

**Stat row (below header, full width):**
Three stats in a row:
```
VENUE              CITY          CAPACITY
Rīgas Boksa klubs  Riga          200 seats
```

**Sections in order:**
1. `ABOUT` — description paragraph
2. `FORMAT` — one line: "Card · One bout per fighter" or "Tournament · Single Elimination"
3. `RULES` — stat grid: ROUNDS / DURATION / SCORING / HEADGEAR
4. `SANCTIONED BY` — org name as link
5. `BRACKET` — bracket component (see Part 4). Header: "TOURNAMENT BRACKET". For club cards: "No bracket — fighters matched on the night." in muted text.
6. `WHY THIS EVENT MATTERS` — paragraph. Olympics gets gold left border `3px solid var(--color-accent-gold)`.
7. `PAST EDITIONS` — compact list or "No previous editions recorded."

---

### Venue Page v2 (`/venue/:venueId`)

**Header:**
```
[Left column]                    [Right: 240px image]
Rīgas Boksa klubs
Riga · Latvia
200 seats
```
- Venue name in Rock Bro
- City · Country below
- Capacity below that

**Sections:**
1. `ABOUT` — description paragraph
2. `HOSTS` — `eligibleFor` as circuit badges in a row
3. `UPCOMING EVENTS` — compact list. Row: `[date] [badge] [event name]`. Single pixel dividers.
4. `PAST EVENTS` — same format. Empty state: single muted line.

---

### Sanctioning Body Page v2 (`/sanctioning-body/:bodyId`)

No image. This page is a document. Lean into it.

Thick left border on the entire page header section — `border-left: 3px solid` in the body's primary circuit level colour (LBF → amber, EUBC → blue-dark, IBA → gold). Gives identity without needing an image.

**Header:**
- Body name in Rock Bro
- Level badge
- Affiliation as link

**Sections:**
1. `ABOUT` — description paragraph

2. `COMPETITION RULES` — age category selector: three small tabs `JUNIOR · YOUTH · SENIOR`. Active tab in `--color-accent-amber`.

   Under each tab, rules grouped by circuit level:
   ```
   CLUB CARD
   3 rounds · 3 min · 10 point must · Headgear required · 10 oz gloves · Max 2 bouts/day

   REGIONAL TOURNAMENT
   3 rounds · 3 min · 10 point must · Headgear required · 10 oz gloves · Max 1 bout/day
   ```
   Circuit level name: 10px stamp label. Rules: single dense line in 12px Inconsolata muted. Single pixel divider between levels. This reads like a technical specification, not a table.

3. `TITLES AWARDED` — list of title names in muted Inconsolata. No decoration.

4. `GOVERNED EVENTS` — circuit badges in a row.

---

## Part 4 — Bracket Component

**`packages/ui/src/components/Bracket.tsx`**

Single elimination bracket. Used on the event full page.

### Props
```typescript
interface BracketProps {
  rounds: number          // number of rounds — 1=final only, 2=semis+final, 3=quarters+semis+final
  entrants?: TournamentEntrant[]   // empty array or undefined = all TBD slots
  winnerId?: string
}
```

### Visual Layout

Columns left to right, one per round. Round label above each column: "QUARTERFINALS", "SEMIFINALS", "FINAL".

Each slot is a rectangular block:
```
┌─────────────────────┐
│ TBD                 │
│ —                   │
└─────────────────────┘
```
When entrant exists:
```
┌─────────────────────┐
│ Jānis Bērziņš       │
│ Valmiera Boxing     │
└─────────────────────┘
```
Slot size: `width: 180px`, `height: 44px`. Background: `--color-bg-mid`. Border: `1px solid var(--color-bg-light)` at 30% opacity. Inconsolata, 11px.

Winner slot: border colour `--color-accent-amber`.
Bye slot: lighter background, "BYE" text in muted.

### Connector Lines

SVG lines connecting slots between rounds. Each slot in round N connects to one slot in round N+1. Lines: `--color-bg-mid`, 1px stroke. Use an SVG overlay or CSS borders — whatever is cleanest in React.

### Bracket Sizes
- 2 entrants: 1 round (final only), 1 bout
- 4 entrants: 2 rounds, 2 bouts → 1 bout
- 8 entrants: 3 rounds, 4 → 2 → 1
- 16 entrants: 4 rounds, 8 → 4 → 2 → 1

When `entrants` is empty — all slots show "TBD" with "—" gym line. The bracket structure still shows with the correct number of rounds and slots.

### On Event Full Page

For tournament events: show `<Bracket rounds={derivedRounds} entrants={[]} />` with header "TOURNAMENT BRACKET" and subtext "Entry opens [X weeks before event] · Bracket drawn when entry closes."

For club card events: replace bracket with single muted line "No bracket — fighters matched on the night."

---

### Definition Of Done
- [ ] Top nav — back/forward arrows, page name, date, finances placeholder, Advance Week button
- [ ] All per-page headers removed from Calendar, Event, Venue, Sanctioning Body pages
- [ ] Calendar day cells — text-only event names in split sections, no pills
- [ ] Event full page v2 — two-column header, stat row, correct section order
- [ ] Venue page v2 — two-column header, small image, compact lists
- [ ] Sanctioning body page v2 — no image, left border identity, rules as dense spec
- [ ] Bracket component — correct slot layout, connector lines, scales by round count
- [ ] Bracket shows on event full page for tournaments, text fallback for club cards
- [ ] `pnpm dev` — pages feel like a specialist sim tool, not a web app
- [ ] `pnpm typecheck` clean
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: top nav + calendar events + page v2 + bracket component`

### Notes
- Read frontend-design skill fully before touching any code
- Images are texture, not heroes — 240px max width, float right, text dominates left
- No card components with visible borders — sections separated by rules only
- Rock Bro for page titles only — everything else Inconsolata
- Advance Week button is skeleton only — no logic wired
- Bracket connector lines can be SVG or CSS — choose whichever is cleaner
- The sanctioning body page has no image — the left border gives it identity instead
- If something looks like a Bootstrap card, it's wrong
