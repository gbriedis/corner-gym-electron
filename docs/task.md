# Current Task

## Task: Font Swap + Naming Fix + Nav Guard + Dynamic Event Names + Rewards Schema

### What To Build
Five focused fixes. Do in order — each is independent but together they clean up significant rough edges.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/rules/data.md`

---

## Part 1 — Font Swap

Replace Rock Bro with the new Corner Gym header font.

**`packages/ui/src/index.css`**

Replace the Rock Bro `@font-face` declaration:
```css
@font-face {
  font-family: 'CornerGymHeader';
  src: url('./assets/fonts/corner-gym-header.otf') format('opentype');
  font-weight: normal;
  font-style: normal;
}
```

**`packages/ui/src/styles/theme.css`**

Update the display font variable:
```css
--font-display: 'CornerGymHeader', serif;
```

Remove any remaining references to 'Rock Bro' across all files. Verify the font loads correctly in `pnpm dev` — the Corner Gym logotype in the top nav and all Rock Bro headings should now use the new font.

---

## Part 2 — Kill "Club Tournament" Display Strings

Audit every file in `packages/ui/src/` for the string "Club Tournament". Replace all display instances.

The correct display label for `club_card` circuit level is **"Club Show"** — not "Club Tournament", not "Club Card" as a user-facing label. "Club Card" is fine as a badge/tag. "Club Show" is the human-readable event name.

Update:
- Circuit level display name map — wherever circuit levels are converted to human readable strings
- Upcoming events sidebar — event names
- Calendar legend
- Event detail panel
- Any other place "Club Tournament" appears as visible text

The `id` value `club_card` stays unchanged in all data and TypeScript — this is display strings only.

---

## Part 3 — Back Navigation Guard

The back arrow in the top nav must not navigate past the game screen. Once the player is in the game, they cannot accidentally navigate back to the new game or load game screens using the back arrow.

**`packages/ui/src/components/layout/TopBar.tsx`**

Add a guard on the back arrow click handler:

```typescript
// Never navigate back past the game screen.
// The game screen is the root of in-game navigation — going back further
// would return the player to the new game or load screens, losing context.
const canGoBack = window.history.state?.idx > 0 && !isAtGameRoot()

function isAtGameRoot(): boolean {
  // Returns true if the current location is the root game screen.
  // Determined by checking if there is no meaningful back history
  // within the game routes.
  return window.history.state?.idx <= 1
}
```

Disable the back arrow when `!canGoBack`. Apply `opacity: 0.3`, `cursor: not-allowed`, `pointer-events: none`.

Test: navigate to Calendar → Event page → Venue page. Back arrow works. Navigate back to Calendar. Back arrow works. One more back goes to Dashboard. Back arrow disables — cannot go further.

---

## Part 4 — Dynamic Event Names

### Engine: Event Name Generation

**`packages/engine/src/generation/calendar.ts`**

Add `generateEventName()` function:

```typescript
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
  usedNames: Set<string>
): string
```

**Naming rules per circuit level:**

`club_card`:
- Base: `[Year] [Venue Short Name] Show`
- Venue short name = first two words of venue name, stripped of "boksa klubs" suffix
- Example: "2026 Rīgas Boksa Show" → too long → "2026 Imanta Show"
- Actually: take the city label and append "Club Show": "2026 Riga Club Show"
- If duplicate in same year: append venue name: "2026 Riga Imanta Show"
- If still duplicate: append sequence: "2026 Riga Club Show #2"

`regional_tournament`:
- Base: `[Year] [City] Open`
- Example: "2026 Riga Open", "2026 Daugavpils Open"
- Duplicates unlikely for regionals — one per city per season

`national_championship`:
- Fixed: `[Year] Latvian National Championships`
- Always unique — one per year

`baltic_championship`:
- Fixed: `[Year] Baltic Boxing Championships`

`european_championship`:
- Fixed: `[Year] European Amateur Boxing Championships`

`world_championship`:
- Fixed: `[Year] IBA World Boxing Championships`

`olympics`:
- Fixed: `[Year] Olympic Games Boxing`

**Uniqueness enforcement:**
Pass a `usedNames: Set<string>` through the generation loop. After assigning a name, add it to the set. Before assigning, check — if present, apply disambiguation logic (venue name, then sequence number).

**Update `CalendarEvent` type:**
Add `name: string` field to `CalendarEvent` in `src/types/calendar.ts`.

**Update SQLite:**
Add `name TEXT NOT NULL DEFAULT ''` column to `calendar_events` table. Use `ALTER TABLE IF NOT EXISTS` migration pattern for existing saves.

**Update all places that display event names** — they should now read `event.name` not derive it from template label.

---

## Part 5 — Rewards Schema

Define what each circuit level awards structurally. No engine logic — data definition only. This schema exists so rewards are designed correctly before fighters are built.

**`packages/engine/data/universal/rewards.json`**

Meta must explain: rewards are awarded to fighters and gyms when they achieve results at each circuit level. Rep and follower rewards are defined here but not wired until gym and fighter systems exist. Belt and medal rewards are structurally complete. The engine reads this file when processing bout results — implementation comes with the fight engine.

```json
{
  "meta": {
    "version": "1.0.0",
    "description": "Rewards awarded per circuit level and result. Rep and follower values are placeholders — they will be calibrated once the gym and fighter reputation systems are built. Belt and medal definitions are final. The engine reads this when processing bout results."
  },
  "circuitRewards": [
    {
      "circuitLevel": "club_card",
      "results": {
        "win": {
          "fighterRep": 1,
          "gymRep": 1,
          "followers": 0,
          "medal": null,
          "belt": null,
          "description": "A win at a club show. Small reputation gain. No title implications."
        },
        "loss": {
          "fighterRep": 0,
          "gymRep": 0,
          "followers": 0,
          "medal": null,
          "belt": null,
          "description": "A loss at a club show. No reputation penalty at this level — experience is the reward."
        }
      }
    },
    {
      "circuitLevel": "national_championship",
      "results": {
        "gold": {
          "fighterRep": 25,
          "gymRep": 15,
          "followers": 50,
          "medal": "gold",
          "belt": "latvian_national_champion",
          "description": "Latvian National Champion. The title belt per weight class. Significant domestic reputation."
        },
        "silver": {
          "fighterRep": 15,
          "gymRep": 8,
          "followers": 20,
          "medal": "silver",
          "belt": null,
          "description": "National finalist. Respected result. No belt."
        },
        "bronze": {
          "fighterRep": 8,
          "gymRep": 4,
          "followers": 10,
          "medal": "bronze",
          "belt": null,
          "description": "National semi-finalist. Solid result for a developing fighter."
        }
      }
    },
    {
      "circuitLevel": "olympics",
      "results": {
        "gold": {
          "fighterRep": 200,
          "gymRep": 150,
          "followers": 10000,
          "medal": "gold",
          "belt": "olympic_champion",
          "description": "Olympic Champion. The ceiling of amateur boxing. Changes everything."
        },
        "silver": {
          "fighterRep": 150,
          "gymRep": 100,
          "followers": 5000,
          "medal": "silver",
          "belt": null,
          "description": "Olympic silver medallist. A legacy result."
        },
        "bronze": {
          "fighterRep": 100,
          "gymRep": 75,
          "followers": 3000,
          "medal": "bronze",
          "belt": null,
          "description": "Olympic bronze. Two bronze medals awarded per weight class."
        }
      }
    }
  ]
}
```

Include all circuit levels: `club_card`, `regional_tournament`, `national_championship`, `baltic_championship`, `european_championship`, `world_championship`, `olympics`.

Tournament events use `gold/silver/bronze` result keys. Club cards use `win/loss`. Rep and follower values scale logically — a national title is worth significantly more than a regional win, Olympics is the ceiling.

Add `RewardsData` TypeScript type in `src/types/data/`. Add to loader. Add to `data-registry.md`.

---

### Definition Of Done
- [ ] `corner-gym-header.otf` wired as `--font-display`, Rock Bro removed everywhere
- [ ] "Club Tournament" display string gone from all UI — replaced with "Club Show" where needed
- [ ] Back arrow disabled when at game root — cannot navigate to new game/load screens
- [ ] `generateEventName()` produces unique realistic names — "2026 Riga Club Show", "2026 Latvian National Championships" etc
- [ ] `CalendarEvent.name` field exists, populated at generation, saved to SQLite
- [ ] All event name displays read from `event.name`
- [ ] `rewards.json` created with all circuit levels, correct result keys
- [ ] `RewardsData` type created and added to loader
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: font swap + naming fixes + nav guard + event names + rewards schema`

### Notes
- Font swap is Part 1 — verify it loads in dev before moving on
- "Club Tournament" is a display string bug — do not change any id values in data or TypeScript
- Back nav guard: the player is in the game — they cannot accidentally leave it via back arrow
- Event names must be unique per year — usedNames Set enforced during generation
- Rewards rep/follower values are placeholders — they will be calibrated later
- Do not wire rewards to any system — data definition only this session
