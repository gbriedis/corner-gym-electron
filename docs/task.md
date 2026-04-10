# Current Task

## Task: Dev Mode Dashboard

### What To Build
A developer dashboard accessible via Ctrl+Shift+D or route /dev. Not visible in normal play. Shows the generated world state so we can verify the simulation is producing realistic results. This is a diagnostic tool — not a game feature.

### Skill To Load
`.claude/skills/public/frontend-design/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## Layout

Full screen overlay. Dark background. Fixed header with "DEV MODE" in amber, current save info, and a close button (Escape also closes).

Left sidebar — navigation between sections:
- World Overview
- Fighter Browser
- Attribute Distributions
- Bout Log
- Gym Financials
- Regenerate

Main content area renders the selected section.

Keyboard shortcut: Ctrl+Shift+D toggles the panel open/closed from anywhere in the game. Only works when a save is loaded.

Route: `/dev` also opens it directly.

---

## Section 1 — World Overview

Summary of what the backrun produced. At a glance health check.

Display:
```
WORLD OVERVIEW
Generated: Latvia + USA  ·  Seed: 4829201  ·  Backrun: 2016–2026

LATVIA                          USA
8 cities                        20 cities
24 gyms                         180 gyms
312 persons                     2,847 persons
187 fighters                    1,923 fighters
89 competing                    901 competing
34 retired                      412 retired
523 bouts resolved              5,241 bouts resolved
12 national champions           87 national champions

PRO ECOSYSTEM
Latvia: Level 1 — Emerging Scene (reached 2024)
USA: Level 4 — Boxing Nation

WEIGHT CLASS DISTRIBUTION
[horizontal bar per weight class showing fighter count]
Flyweight ████░░░░░░ 23
...
Heavyweight ████████░░ 47
```

All data read from SQLite via IPC. One query per nation.

---

## Section 2 — Fighter Browser

Browse all generated fighters. Filter and inspect.

**Controls:**
- Nation filter: Latvia / USA / All
- City filter: dropdown of cities
- Identity state filter: all / competing / aspiring / retired / unaware
- Weight class filter
- Sort: by record (wins desc), by readiness, by age, by attribute total

**Fighter list** — compact rows:
```
[Identity badge] Name              City          Record    Age  Weight Class
[COMPETING]      Jānis Bērziņš     Valmiera      8-2       24   Lightweight
[RETIRED]        Darius Thompson   Detroit       23-4      38   Welterweight
```

Clicking a row opens the fighter detail panel.

**Fighter detail panel** (right side, 40% width):
- Full name, age, nation, city, gym
- Identity state + how long in current state
- Weight class, competition status, record (W-L-KO)
- Soul traits — ALL revealed, no ocean rule in dev mode. Show all 8 pairs with which side this fighter has.
- Developed attributes — full table, all 22 attributes with current value and ceiling
- Physical attributes — power, hand speed, chin etc with current value
- Style: tendency + strength percentage
- Coach quality if assigned
- Last 5 bouts from bout log — opponent, result, method, round

---

## Section 3 — Attribute Distributions

Bell curve visualisation for each attribute across the full fighter population.

**Controls:**
- Nation filter
- Attribute selector — dropdown of all 22 attributes
- Filter by: all fighters / competing only / by weight class

**Chart:**
Histogram showing distribution of current values for selected attribute.
X axis: 1-20
Y axis: fighter count
Bar chart, amber bars, clean minimal style.

Below the chart:
```
POWER — All Latvia fighters (187)
Mean: 8.3  ·  Median: 8  ·  Min: 2  ·  Max: 16  ·  Std Dev: 2.4
```

Show distributions for multiple attributes simultaneously if useful — maybe a 2×2 grid of the four most important: power, chin, ring_iq, heart.

---

## Section 4 — Bout Log

The last 200 bouts resolved during the backrun, most recent first.

**Each row:**
```
[Date]        [Circuit]      Fighter A vs Fighter B          Result
2025 W34      Regional       J. Bērziņš vs K. Ozols          W KO R2
2025 W34      Club Card      D. Thompson vs M. Garcia         W Dec
```

**Filters:**
- Nation
- Circuit level
- Method (KO/TKO/Decision/Split)
- Year range

**Summary stats below the list:**
```
BOUT LOG SUMMARY (Last 200 bouts)
KO/TKO: 34%  ·  Decision: 58%  ·  Split/Majority: 21% of decisions
Average end round: 4.2  ·  Average scheduled rounds: 6.0
```

These percentages reveal if the simulation feels like boxing. Real boxing has roughly 35-40% stoppages at amateur level, more at pro level. If we're seeing 80% KOs something is wrong with the damage calculation.

---

## Section 5 — Gym Financials

Pick a gym, see its financial history over the backrun.

**Gym selector** — searchable dropdown of all gyms with city.

**Display:**
```
RĪGAS BOKSA KLUBS  ·  Riga, Latvia  ·  Competition Gym

CURRENT STATE
Balance: €4,230  ·  Monthly rent: €680  ·  Members: 34  ·  Fighters: 18

FINANCIAL HISTORY
[Line chart — balance over 10 years, one point per month]

LOW POINTS
2019 W23: Balance dropped to €-340 (rent + staff exceeded membership income)
2021 W14: Balance dropped to €120

EQUIPMENT STATE
boxing_ring       ████████░░  78% condition
heavy_bag (×4)    ██████░░░░  61% condition avg
speed_bag         ████░░░░░░  42% condition
```

Line chart: x axis = years 2016-2026, y axis = balance in euros. Simple, readable. Shows whether the financial simulation produced realistic gym economics.

---

## Section 6 — Regenerate

Simple utility section.

```
REGENERATE WORLD

Current seed: 4829201
New seed: [input field]  [Random]

Include nations:
☑ Latvia
☑ USA

[REGENERATE WITH NEW SEED]

Warning: This will wipe the current save and regenerate everything.
Backrun will run again. Takes ~10 seconds.
```

Clicking regenerate triggers the full generate-and-save flow with the new seed. Loading screen shows. Returns to dev mode when complete.

---

## IPC Requirements

New IPC endpoints needed:

```typescript
// Returns world summary stats for all included nations
'dev-world-summary' → WorldSummary

// Returns paginated fighter list with filters
'dev-fighter-list' → { fighters: FighterListItem[], total: number }

// Returns full fighter detail including all soul traits revealed
'dev-fighter-detail' → FighterDevDetail

// Returns attribute distribution for a specific attribute
'dev-attribute-distribution' → { attribute: string; distribution: number[]; stats: DistributionStats }

// Returns last N bouts with filters
'dev-bout-log' → { bouts: BoutLogEntry[]; summary: BoutLogSummary }

// Returns gym financial history
'dev-gym-financials' → GymFinancialDetail
```

All endpoints require a `saveId` parameter. Return empty/null gracefully if no save loaded.

---

## Routing

**Update `packages/ui/src/App.tsx`**

Add `/dev` route → `DevDashboard` component.

Add global keyboard listener for Ctrl+Shift+D — navigates to `/dev` if save is loaded, does nothing otherwise.

---

## Design Notes

This is a tool, not a game screen. Design accordingly:

- Dense information is fine — this is for the developer, not a player
- Monospace text everywhere — Inconsolata suits this perfectly
- Amber accents for important numbers and labels
- No animations except the loading states
- Tables and lists over cards — data density matters here
- The "DEV MODE" label in the header should be clearly amber and visible — this should never be confused with a game screen

---

### Definition Of Done
- [ ] Ctrl+Shift+D opens dev dashboard from anywhere in the game
- [ ] `/dev` route works
- [ ] World Overview — nation stats, pro ecosystem state, weight class distribution
- [ ] Fighter Browser — filterable list, full detail panel with all traits revealed
- [ ] Attribute Distributions — histogram per attribute with stats
- [ ] Bout Log — last 200 bouts with filters and summary percentages
- [ ] Gym Financials — balance history chart, equipment state
- [ ] Regenerate — new seed, nation selection, triggers full regenerate
- [ ] All 6 IPC endpoints implemented in ipc.ts and db.ts
- [ ] Dev dashboard only accessible when save is loaded
- [ ] `pnpm dev` — dashboard opens, shows real data from backrun
- [ ] `pnpm typecheck` clean
- [ ] `docs/structure.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: dev mode dashboard`

### Notes
- Read frontend-design skill before writing any UI code
- Dense information is correct here — this is a diagnostic tool
- All soul traits revealed in dev mode — ocean rule does not apply
- Bout log percentages are the most important health check — ~35% stoppages is realistic for amateur boxing
- Financial history chart needs real data from revenueHistory on gym records
- Regenerate must go through the full generate-and-save IPC flow — not a shortcut
- If no save is loaded, dev dashboard shows "No save loaded — start a new game first"
