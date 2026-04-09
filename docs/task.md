# Current Task

## Task: UI Polish — Event Page, Venue Page, Sanctioning Body Page

### What To Fix
All three detail pages look like database printouts. They have the right content but no visual character. This task is purely visual — no new features, no new data, no logic changes. Pure UI polish.

### Skill To Load
`.claude/skills/public/frontend-design/SKILL.md`

---

## The Aesthetic Direction

These pages should feel like a worn boxing programme. The kind of thing a Latvian coach carries in his coat pocket — ink on paper, dense but considered. Not a website. Not a dashboard. Something with texture and weight.

**Rules:**
- Section headers: uppercase, tracked letter-spacing, small font size, muted colour — like a label stamped on old equipment. Never large. Never bold headline style.
- Body text: Inconsolata naturally has character. Give it room to breathe — `line-height: 1.7`. Don't squeeze.
- Section dividers: single pixel rule `var(--color-bg-mid)`, not padding gaps alone. Creates printed document feel.
- Data points: two-column stat grid. Label small and muted ABOVE, value larger and primary BELOW. Never `Label: Value` on one line — that's a form, not a programme.
- Venue image: bleeds edge to edge at top of page. No border radius. No margin. Like a photograph pinned to a notice board.
- Colour: background is dark, text is primary. Colour appears only on badges, circuit level indicators, and one accent element per page. Nowhere else.
- Spacing: generous between sections, tight within them.

---

## Event Full Page (`/calendar/event/:eventId`)

### Header
No padding above the venue image. Image bleeds full width, 21:9 ratio, no border radius, no shadow. Graceful fallback if no image — dark placeholder with venue name centred in muted text.

Overlaid on the bottom of the image, a dark gradient scrim (bottom 40% of image fades to `--color-bg-dark`). On top of the scrim:
- Event name in Rock Bro font, large, `--color-text-primary`
- Circuit level badge + format indicator on same line below the name
- Date in small Inconsolata, muted, bottom right of scrim

Back button top left — small, `← Back`, no background, just text. Sits above the image not on top of it.

### Stat Row
Immediately below the image. Single horizontal row of 3-4 stat blocks in a dark bar (`--color-bg-mid` background, full width, no border radius).

Each stat block:
```
VENUE              CITY               CAPACITY           DATE
Rīgas Boksa klubs  Riga, Latvia       200 seats          17 Jan 2026
```

Label: 10px uppercase tracked muted text.
Value: 14px `--color-text-primary`.

Venue and city values are links — hover underline, no button styling.

### Sections below the stat row

Each section:
- Section label: 10px uppercase tracked `--color-text-muted`, margin-bottom 8px
- Single pixel divider above the label
- Content below

**ABOUT**
Description paragraph. Inconsolata, `line-height: 1.7`. No box, no card — just text.

**FORMAT**
Single line. "Card · One bout per fighter · Results same night" or "Tournament · Single Elimination · [X] Day Event". Muted text, smaller.

**RULES**
Three stat blocks in a row (same pattern as the header stat row but smaller):
```
ROUNDS     DURATION      SCORING
3          3 min each    10-point must
```

**SANCTIONED BY**
Organisation name as a link. No label box. Just: `SANCTIONED BY` label above, organisation name below as a hover-underline link.

**TOURNAMENT BRACKET**
Dark inset box (`background: rgba(0,0,0,0.3)`, `border: 1px solid var(--color-bg-mid)`). Inside: placeholder text in muted Inconsolata. No visual clutter — just the message and the entry note.

**WHY THIS EVENT MATTERS**
The paragraph text for each circuit level. No label box. Just the `WHY THIS EVENT MATTERS` stamp label above, paragraph below. This section has the most character — give the text room.

For Olympics: the entire section gets a gold left border (`border-left: 3px solid var(--color-accent-gold)`), gold label colour, slightly larger text. The weight of it should be felt without being garish.

**PAST EDITIONS**
If empty: single line muted text "No previous editions recorded." — no empty state card.
If populated: compact list. Each row: `[Year] · [City] · [Venue]` — all on one line, muted separators.

---

## Venue Page (`/venue/:venueId`)

### Header
Same as event page — image bleeds full width, 21:9, no border radius. Dark gradient scrim on bottom portion.

On the scrim:
- Venue name in Rock Bro font, large
- City · Country in small Inconsolata below
- Capacity badge bottom right — `[200 seats]` in a small pill

### Stat Row
Three stat blocks:
```
CITY               COUNTRY            CAPACITY
Riga               Latvia             200 seats
```

### Sections

**ABOUT**
Description paragraph. No box.

**HOSTS**
`eligibleFor` circuit levels shown as badges in a row. No label box above badges — just the `HOSTS` stamp and the badges.

**UPCOMING EVENTS**
Compact list. Each row:
```
17 Jan 2026    [Club Card]    Club Tournament
7 Feb 2026     [Club Card]    Club Tournament
```
Date left-aligned muted, badge, event name. Single pixel dividers between rows. No cards, no padding boxes.

Empty state: "No upcoming events scheduled." — single muted line.

**PAST EVENTS**
Same compact list format. Empty state: "No recorded events yet."

---

## Sanctioning Body Page (`/sanctioning-body/:bodyId`)

### Header
No image — this page is text-heavy by nature. That's fine. Lean into it.

Large body name in Rock Bro font. Below it: level badge (National / Continental / International). Below that: affiliation as a link.

Top of page has a thick left border accent in the circuit level colour most associated with this body — LBF gets amber (national championship colour), EUBC gets blue-dark, IBA gets gold.

### Sections

**ABOUT**
Description paragraph. `line-height: 1.7`. No box.

**COMPETITION RULES**
This is the most important section on this page. Style it like an official document — it IS one.

Age category tabs or segmented control: Junior | Youth | Senior. Switching shows rules for that category.

Rules displayed as a tight grid — not a standard HTML table. Each rule:
```
ROUNDS    DURATION    REST       SCORING           HEADGEAR    GLOVES
3         3 min       1 min      10-point must     Required    10 oz
```

Monospace, small, tight rows. Alternating row background: transparent and `rgba(255,255,255,0.02)`. Single pixel dividers. This should feel like reading a technical specification.

Group rows by circuit level within the age category tab:

```
CLUB CARD
3 rounds · 3 min · 10-point must · Headgear required · 10 oz · Max 2 bouts/day

REGIONAL TOURNAMENT  
3 rounds · 3 min · 10-point must · Headgear required · 10 oz · Max 1 bout/day

NATIONAL CHAMPIONSHIP
3 rounds · 3 min · 10-point must · Headgear required · 10 oz · Max 1 bout/day
```

Circuit level as a stamp label above each group. Rules on one dense line below. Not a table — a list of specifications.

**TITLES AWARDED**
`TITLES AWARDED PER WEIGHT CLASS` stamp label. Below: simple list of title names. No table, no cards. Just the list in muted Inconsolata.

**GOVERNED EVENTS**
Circuit level badges in a row. That's it.

---

## Global Rules For All Three Pages

- No card components with borders and padding that look like web UI cards
- No coloured background boxes for sections — sections are separated by rules and spacing only
- No centre-aligned text anywhere except the placeholder/empty states
- Back button is always top-left, small, text only — no button styling
- All links: normal text colour, no underline at rest, underline on hover, cursor pointer
- Scrollbar: 4px, barely visible (already implemented — verify it applies to these pages)
- Page max-width: 900px centred, generous horizontal padding on smaller windows

---

### Definition Of Done
- [ ] Event full page — image bleeds full width, stat row, sections with stamp labels
- [ ] Event full page — Olympics section has gold left border treatment
- [ ] Venue page — image bleeds full width, compact event lists
- [ ] Sanctioning body page — rules as dense specification list, age category tabs
- [ ] No card borders, no coloured section backgrounds
- [ ] All links are hover-underline style, no button styling
- [ ] Back buttons are text only, top left
- [ ] `pnpm dev` — all three pages feel like a boxing programme, not a website
- [ ] `pnpm typecheck` clean
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `polish: event, venue, sanctioning body pages`

### Notes
- This is a visual task only — no new data, no new logic, no new routes
- Read the frontend-design skill fully before touching any code
- The aesthetic is worn boxing programme — ink on paper, dense but considered
- If something looks like a modern web app card, it's wrong
- Rock Bro is for display headings only — venue name, event name, body name
- Inconsolata for everything else
- Colour appears sparingly — badges and one accent per page only
