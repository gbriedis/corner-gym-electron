# Current Task

## Task: Pro System + Belt Tracking

### What To Build

A complete pro boxing ecosystem that runs during the backrun and live play:
- Amateur-to-pro transition for fighters who reach elite amateur level
- Pro event generation and resolution (separate circuit, different rules)
- Pro belt tracking — who holds which title at any point in time
- Pro rankings per organisation per weight class
- National geographic isolation already fixed (see commits) — this task is the remaining pro architecture

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## Context: What Was Fixed This Session

- **Calendar geographic isolation**: Latvia players no longer see USA club shows.
  Events are filtered to `playerNationId OR nationId = 'international'` in all
  `loadCalendar` / `getUpcomingEvents` queries.
- **International events**: now tagged `nationId: 'international'` instead of
  the first rendered nation, so they appear for all players correctly.
- **National championship naming**: no longer hardcoded "Latvian National
  Championships" — now uses `data.nations[nationId].nation.label`.
- **Persons table bug**: fighters were never persisted (world gen returns
  `persons: []`, fighters are separate). Fixed by passing fighters to
  `createSave`. Pipeline fighters from `annualTick` now INSERTed via
  `insertFighter` before `updateFighter` runs.
- **Dev mode dashboard**: shows all identity state counts, correct bout count
  (÷2), attribute distributions filter to competing fighters only.

---

## Part 1 — Amateur → Pro Transition

**Location:** `packages/engine/src/engine/identityTick.ts` (or new `proTick.ts`)

A competing amateur becomes pro when they meet a threshold. Pro ecosystem level
in the nation data controls how developed the pro scene is.

Transition triggers (any one sufficient):
- Won a national championship (fighter.competition.amateur.titles includes national_championship or golden_gloves)
- Accumulated ≥ 20 amateur wins with a winning record
- Age ≥ 28 with ≥ 10 amateur wins (late-career pro turn)

On transition:
- `fighter.competition.status = 'pro'`
- `fighter.competition.pro.turnedProYear = state.year`
- Reset `career.lastBoutYear` to current year so inactivity doesn't fire immediately

**Gate**: only trigger in nations where `proEcosystemStartLevel >= 2`. Latvia is
developing; USA is fully established.

---

## Part 2 — Pro Rules and Events

**Location:** New `packages/engine/data/universal/pro-rules.json` (or use
existing `pro-fight-offer.json` structure)

Pro bouts use different rules than amateur:
- No headgear
- 8-12 rounds (weight class determines max)
- 10-point must scoring (different from amateur)
- Stoppage thresholds are looser (refs allow more punishment before stopping)

**Pro event calendar**: each nation that has `proEcosystemStartLevel >= 1`
generates pro club cards. Level 3+ generates pro regional shows. Level 4+
generates championship-level pro events.

Pro events should be tagged with `competition: 'pro'` in the CalendarEvent so
the event tick knows which ruleset to apply.

---

## Part 3 — Belt Tracking

**Location:** `packages/engine/src/types/worldState.ts` + new `beltRegistry.ts`

Add to WorldState:
```typescript
proTitles: Record<string, ProTitleRecord>
// keyed by "${orgId}-${weightClassId}" e.g. "wbc-heavyweight"
```

```typescript
interface ProTitleRecord {
  beltId: string          // from pro-title-belts.json
  holderId: string | null // fighter id, null = vacant
  wonYear: number
  wonWeek: number
  defences: number
}
```

**Title changes**:
- When a pro fighter wins a title fight, update `worldState.proTitles`
- Title fights are generated as part of the pro event calendar
- `worldState.proTitles` is serialised with the WorldState JSON in SQLite

---

## Part 4 — Pro Rankings

**Location:** `packages/engine/src/engine/proRankings.ts`

Run annually (alongside `runAnnualPipeline`). For each pro organisation × weight
class: rank all active pro fighters by a composite score of wins, opposition
quality, and recency. Top 15 are the contenders.

Store rankings in WorldState:
```typescript
proRankings: Record<string, string[]>
// keyed by "${orgId}-${weightClassId}", value = ordered fighter ids
```

The top contender challenges the belt holder in the next available pro event slot.

---

## Part 5 — Event Tick Pro Resolution

**Location:** `packages/engine/src/engine/eventTick.ts`

Add `resolveProCard` function:
- Collects eligible pro fighters from the nation
- Uses pro rules (from ruleset data) not amateur rules
- Tracks whether a title is at stake and updates `worldState.proTitles` on result

```typescript
if (event.competition === 'pro') {
  totalBouts += resolveProCard(event, state, data, rng)
}
```

---

## Verification Targets

After running a 10-year backrun with a USA seed:
- Pro fighters: 5-15% of total fighter pool
- Belts: all major weight classes have a holder after year 3+
- Pro bouts: 200-500 total over the 10-year period
- Top pro fighters: 10-25 pro bouts, age 26-36

After running a Latvia seed:
- Pro scene smaller (proEcosystemStartLevel lower)
- 0-5 pro fighters emerging over 10 years
- No domestic pro titles until pro ecosystem develops

---

## Files That Will Change

| File | Change |
|------|--------|
| `packages/engine/src/types/worldState.ts` | Add `proTitles`, `proRankings` |
| `packages/engine/src/types/fighter.ts` | `turnedProYear` already in competition.pro |
| `packages/engine/src/types/calendar.ts` | Add `competition: 'amateur' \| 'pro'` field |
| `packages/engine/src/engine/identityTick.ts` | Add amateur→pro transition |
| `packages/engine/src/engine/eventTick.ts` | Add `resolveProCard` |
| `packages/engine/src/engine/annualTick.ts` | Add `runAnnualProRankings` call |
| `packages/engine/src/generation/calendar.ts` | Generate pro events per nation |
| `packages/desktop/src/db.ts` | Persist proTitles with worldState |
