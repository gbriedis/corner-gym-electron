# Current Task

## Task: Calendar Fix — Frequency Data, Engine Recalibration, International Cities, UI Rebuild

### What To Build
Fix the calendar engine so events feel realistic, fix international city representation, rebuild the calendar UI as a proper month grid with event detail views and venue images.

Do in this order: data fixes → engine fixes → UI rebuild.

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`
`.claude/skills/public/frontend-design/SKILL.md`

---

## Part 1 — Data Fixes

### Update `nations/latvia/cities.json`

Add two fields to every city entry:

```json
{
  "id": "latvia-valmiera",
  "boxingActivityLevel": "low",
  "eventHostingFrequency": {
    "club_tournament": { "min": 2, "max": 3 },
    "regional_open": { "min": 1, "max": 2 }
  }
}
```

`boxingActivityLevel`: `"low"` | `"medium"` | `"high"`. Informational — used by UI to set tone.

`eventHostingFrequency`: per event type, min/max times per year. Engine reads this instead of guessing.

Frequency guidelines based on city size and boxing culture:
- Valmiera (small_town): club 2-3, regional 1-2
- Riga (capital): club 5-7, regional 3-4
- Daugavpils (mid_city): club 3-4, regional 2-3
- Liepāja (mid_city): club 3-4, regional 2-3
- Jelgava (mid_city): club 2-3, regional 1-2
- Jūrmala (small_town): club 1-2, regional 0-1
- Rēzekne (mid_city): club 2-3, regional 1-2
- Jēkabpils (small_town): club 1-2, regional 0-1

Update TypeScript type `City` in `src/types/data/cities.ts` to include both new fields.

---

### Update `international/boxing/venues.json`

Every venue entry must have `city` and `country` as plain display strings — not game city ids. This is already the case but verify it is consistent.

International CalendarEvents will use `venue.city` and `venue.country` directly for display. No mapping to game city ids needed. The `cityId` field on international CalendarEvents stores `venue.city` as a display value, not a reference.

Update `CalendarEvent` type — add `countryDisplay?: string` field for international events. Domestic events leave it undefined.

---

## Part 2 — Engine Fixes

### Update `src/generation/calendar.ts`

**Fix 1 — City frequency from data**

Replace hardcoded frequency fallbacks with city data lookup:

```typescript
// Frequency comes from city.eventHostingFrequency[circuitLevel].
// This ensures Valmiera generates 2-3 club tournaments per year
// while Riga generates 5-7. The data owns the frequency, not the engine.
const cityFreq = cityData?.eventHostingFrequency?.[circuitLevel]
const freq = cityFreq !== undefined
  ? rng.nextInt(cityFreq.min, cityFreq.max)
  : 2  // conservative fallback if city data missing
```

The engine must look up city data from `data.nations[nationId].cities.cities` when generating events for a city.

**Fix 2 — Stagger regional opens**

Regional opens across different cities must not all land on the same week. After picking a week for each city's regional open, check if any other regional open is already in that week — if so, shift by 1-2 weeks. Regional opens should feel like they happen across the year, not all on the same weekend.

**Fix 3 — International city representation**

For international events, set `cityId = venue.city` and `countryDisplay = venue.country`. No fake city id construction. The CalendarEvent stores what it needs for display without pretending international venues are part of the game's city system.

**Fix 4 — Weight classes**

Replace the placeholder `weight_class_1..N` strings with real weight class ids from `data.weightClasses`. Pick `weightClassCount` classes from the full list. For club tournaments pick lighter weight classes more frequently — they dominate grassroots boxing.

---

## Part 3 — Calendar UI Rebuild

Complete rebuild of `packages/ui/src/screens/Calendar.tsx`.

### Layout

**Month grid view** — the default view. Shows one month at a time. Navigation arrows to go previous/next month. Current month and year displayed prominently.

The grid is a standard 7-column calendar grid (Mon–Sun). Each day cell shows its date number. If an event falls on that day, it appears as a coloured pill/chip inside the cell. Multiple events in one day stack vertically.

Event pills in the grid:
- Club tournament → muted colour, small
- Regional open → blue, small
- National championship → amber, medium
- Baltic+ → gold, slightly larger
- European/World/Olympics → prominent, glowing accent

Clicking an event pill opens the event detail panel.

### Event Detail Panel

Slides in from the right or opens as a modal. Shows full event information.

**All events show:**
- Event name, circuit level badge
- Venue name, city, country
- Venue image — load from `assets/venues/{venueId}.jpg`. If image not found, show a styled placeholder with the venue name — dark background, venue name centred in muted text. Never a broken image.
- Capacity (from venue data) — shown with a seat icon
- Governing body (sanctioning body label)
- Full weight class list — each as a small badge
- Status badge
- Entry slots section — shows weight classes with placeholder "Enter Fighter" buttons. Buttons are visible but disabled. Add a small tooltip or note: "Fighter entry available once gym roster is set up." This is not dead code — the structure exists, activation comes later.

**National championship adds:**
- Host city rotation note — "Hosted in [city] this year"
- LBF branding treatment

**International events (Baltic+) add:**
- Participating nations listed
- Selection method note — "Open entry" or "Federation selection — apply through LBF"

**Olympics specifically:**
- Gold accent treatment throughout the detail panel
- "Every 4 years" note
- Next occurrence year prominently displayed
- Larger venue image

### Venue Images

Load venue images from `packages/ui/src/assets/venues/`. Filename matches venue id exactly: `{venueId}.jpg` or `{venueId}.png`.

```typescript
// Venue images are matched by venue id.
// If the image file does not exist, show a styled placeholder.
// Never use a broken img tag — always handle missing images gracefully.
function getVenueImagePath(venueId: string): string | null {
  // Try jpg then png — return null if neither found
}
```

Create `packages/ui/src/assets/venues/` folder. Add a `placeholder.jpg` — a dark image with subtle texture for use when venue image is missing.

### Navigation

Add month navigation — previous/next arrows. Keyboard left/right arrow support.

Add a "Today" button that jumps to current in-game week/month.

Year displayed in header. When navigating past December, rolls to next year automatically.

---

## Part 4 — Update Types

**Update `src/types/calendar.ts`**
Add `countryDisplay?: string` to `CalendarEvent`.

**Update `src/types/data/cities.ts`**
Add `boxingActivityLevel` and `eventHostingFrequency` fields.

---

### Definition Of Done
- [ ] `cities.json` — all cities have `boxingActivityLevel` and `eventHostingFrequency`
- [ ] City TypeScript type updated
- [ ] Calendar engine uses city frequency data — no hardcoded fallbacks beyond conservative default
- [ ] Regional opens staggered — no two in the same week
- [ ] International events use `venue.city` + `venue.country` for display
- [ ] Weight classes use real ids from data
- [ ] Calendar UI is a proper month grid
- [ ] Event pills in grid are colour-coded by prestige
- [ ] Event detail panel shows venue image (with graceful fallback)
- [ ] Entry slots section exists but disabled — tooltip explains why
- [ ] Olympics detail panel has gold treatment
- [ ] `assets/venues/` folder created with placeholder
- [ ] `pnpm dev` — calendar feels like a real boxing calendar
- [ ] `pnpm typecheck` clean
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: calendar fix — realistic frequency, proper grid UI, venue images`

### Notes
- Read frontend-design skill before touching any UI code
- The calendar should feel like a sports calendar — not a list, not a spreadsheet
- Venue image fallback must never show a broken image tag
- Entry slots exist structurally but are disabled — this is intentional, not incomplete
- Regional open staggering is important for realism — events happening every weekend in every city simultaneously is wrong
- Olympics gold treatment should feel earned and special — not just a colour change
