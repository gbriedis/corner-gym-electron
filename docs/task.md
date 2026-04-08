# Current Task

## Task: Circuit Level Rename + Calendar UI Multi-Day Update

### What To Build
Two things in sequence. Rename circuit level ids throughout the entire codebase first, then update the calendar UI to reflect the new names and show multi-day event structure properly.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/skills/public/frontend-design/SKILL.md`

---

## Part 1 — Rename Circuit Level IDs

### The Renames
```
club_tournament  →  club_card
regional_open    →  regional_tournament
```

Everything else stays the same.

### Files To Update

**Data files:**
- `nations/latvia/boxing/amateur-circuit.json` — id fields and any references
- `nations/latvia/boxing/event-templates.json` — circuitLevel fields
- `nations/latvia/boxing/lbf-rules.json` — circuitLevel fields
- `nations/latvia/boxing/venues.json` — eligibleFor arrays
- `international/boxing/event-templates.json` — any references
- `international/boxing/eubc-rules.json` — any references
- `international/boxing/iba-rules.json` — any references

**TypeScript:**
- `src/types/data/boxing.ts` — `CircuitLevel` union type
```typescript
export type CircuitLevel =
  | 'club_card'              // was club_tournament
  | 'regional_tournament'    // was regional_open
  | 'national_championship'
  | 'baltic_championship'
  | 'european_championship'
  | 'world_championship'
  | 'olympics'
```

**Engine code — search and replace all string literal references:**
- `src/generation/calendar.ts` — any hardcoded circuit level strings
- `src/generation/bracket.ts` — any references
- Any other engine file referencing old ids

**Desktop/IPC:**
- `packages/desktop/src/db.ts` — any hardcoded strings in queries or defaults
- `packages/desktop/src/ipc.ts` — any references

**UI:**
- `packages/ui/src/screens/Calendar.tsx` — badge colours, labels, any switch/case on circuit level

### Verification
After rename, run `pnpm typecheck` — TypeScript will catch any missed string literals that were typed. Then `pnpm test` — all 79 tests must still pass. Any test failures indicate a missed rename.

---

## Part 2 — Calendar UI Updates

### Circuit Level Display Names and Badge Colours

Update all circuit level display labels and badge colours to match new ids and reflect actual meaning:

| Circuit Level | Display Label | Badge Colour | Badge Style |
|--------------|---------------|--------------|-------------|
| `club_card` | "Club Card" | muted/grey | small, understated |
| `regional_tournament` | "Regional" | `--color-accent-blue` | small |
| `national_championship` | "Nationals" | `--color-accent-amber` | medium, slightly bolder |
| `baltic_championship` | "Baltic" | `--color-accent-green` | medium |
| `european_championship` | "European" | `--color-accent-blue-dark` | medium-large |
| `world_championship` | "Worlds" | `--color-accent-gold` | large |
| `olympics` | "Olympics" | gold gradient, glowing | largest, special treatment |

---

### Multi-Day Event Display in Calendar Grid

Multi-day events span multiple calendar days. The grid must show this clearly.

**In the month grid:**
Multi-day events (anything with `multiDay: true`) show as a spanning pill across their days in the grid. Day 1 pill shows the event name with "D1" indicator. Days 2 and 3 show a continuation pill in the same colour with "D2", "D3" labels. If the days span across weeks in the grid, the continuation pill appears at the start of the next row.

Single-day events show as normal pills.

**Event pill content:**
- Single-day: `[Badge] Event Name`
- Multi-day Day 1: `[Badge] Event Name · D1/3`
- Multi-day continuation: `[Badge] · D2/3` (lighter opacity, clearly a continuation)

---

### Event Detail Panel — Multi-Day Structure

When a multi-day event is clicked, the detail panel shows the full day structure.

**Day structure section** (below venue info, above weight classes):

```
Competition Schedule
━━━━━━━━━━━━━━━━━━━
Day 1 · Fri 6 Nov    Quarterfinals
Day 2 · Sat 7 Nov    Semifinals  
Day 3 · Sun 8 Nov    Finals
━━━━━━━━━━━━━━━━━━━
```

Each day row shows: day number, day of week + date, round label. Use a subtle left border accent in the circuit level colour.

Current day highlighted if event is in progress. Completed days shown with a checkmark. Upcoming days shown normally.

---

### Updated Event Detail Panel — General Improvements

**Header section:**
- Event name in `--font-body`, uppercase, tracked
- Circuit level badge — larger than in the grid pill
- For multi-day: "3-day event" subtitle in muted text

**Venue section:**
- Venue image (existing — 16:9 ratio, graceful fallback)
- Below image: venue name bold, city · country on same line, capacity with seat icon
- For international events: country flag emoji next to country name if available

**Format indicator:**
- Single-day card events: "Card Format · One bout per fighter"
- Tournament events: "Tournament · Single Elimination"
- Multi-day: "Tournament · Single Elimination · 3 Days"

**For Club Card specifically:**
- Tone should feel informal — "Informal card. One bout per fighter. Results same night."
- No bracket structure shown — it doesn't have one

**For Nationals/International specifically:**
- Show the full day schedule
- Show "Entry closes [X weeks before event]" — calculate from current game week
- Show participating nations for international events

**Olympics detail panel** (existing gold treatment — enhance):
- Full gold gradient header
- "Every 4 years" prominently shown
- Next occurrence year large
- "Selection via federation" note with explanation
- Venue image takes more vertical space — 21:9 ratio

---

### Upcoming Events Panel (right sidebar)

Update circuit level labels and colours to match new naming. No structural changes needed.

---

### Definition Of Done
- [ ] All `club_tournament` → `club_card` renames complete in data and code
- [ ] All `regional_open` → `regional_tournament` renames complete
- [ ] `pnpm typecheck` clean after rename
- [ ] All 79 existing tests still passing after rename
- [ ] Calendar grid shows multi-day events as spanning pills
- [ ] Day continuation pills have correct D1/D2/D3 indicators
- [ ] Event detail panel shows day schedule for multi-day events
- [ ] Circuit level badges updated with new labels and colours
- [ ] Club card detail tone is informal
- [ ] Olympics detail panel enhanced with gold treatment
- [ ] `pnpm dev` — calendar looks correct, multi-day events visible
- [ ] `docs/data-registry.md` updated if any new files created
- [ ] `docs/structure.md` updated if any new files created
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: circuit level rename + calendar multi-day UI`

### Notes
- Read frontend-design skill before touching any UI code
- Rename first, UI second — do not mix them
- TypeScript will catch most missed renames if CircuitLevel union is updated first
- Club card has no bracket — never show bracket UI elements for club_card events
- Multi-day spanning pills: if days span a week boundary in the grid, show continuation at start of new row
- Day schedule dates: calculate real dates from year + week number + day of week
