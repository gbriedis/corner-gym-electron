# Current Task

## Task: Competition Infrastructure — Rules, Types, SQLite, Bracket Generation

### What To Build
Fix event format data, create rules files for LBF/EUBC/IBA, define all competition TypeScript types, create SQLite tables, and build bracket generation. No fight simulation — containers and structure only. Brackets generate empty, results come later.

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## Part 1 — Fix Event Format Data

### Update `nations/latvia/boxing/amateur-circuit.json`

Fix format values:
- `club_tournament` → `format: "card"` — collection of individual bouts, no bracket advancement
- `regional_open` → `format: "tournament_bracket"` — fighters advance through rounds
- `national_championship` → `format: "tournament_bracket"`, add `multiDay: true`, add `daysStructure`:

```json
{
  "id": "national_championship",
  "format": "tournament_bracket",
  "multiDay": true,
  "daysStructure": [
    { "day": 1, "label": "Quarterfinals", "roundNumber": 1 },
    { "day": 2, "label": "Semifinals", "roundNumber": 2 },
    { "day": 3, "label": "Finals", "roundNumber": 3 }
  ]
}
```

### Update `international/boxing/circuits.json`

Same fixes for international levels:
- `baltic_championship` → `tournament_bracket`, `multiDay: true`, same days structure
- `european_championship` → `tournament_bracket`, `multiDay: true`
- `world_championship` → `tournament_bracket`, `multiDay: true`
- `olympics` → `tournament_bracket`, `multiDay: true`

Update `CircuitLevelDefinition` type in `src/types/data/boxing.ts` to include `multiDay?: boolean` and `daysStructure?: EventDay[]`.

---

## Part 2 — Rules Data Files

### `nations/latvia/boxing/lbf-rules.json`

Meta must explain: LBF rules govern all domestic amateur competition in Latvia. Rules vary by circuit level and age category. The engine reads these when determining bout parameters. Round limits, scoring, and equipment requirements all come from here — never hardcoded in engine functions.

```json
{
  "sanctioningBodyId": "lbf",
  "ageCategories": [
    { "id": "junior", "label": "Junior", "minAge": 13, "maxAge": 14 },
    { "id": "youth", "label": "Youth", "minAge": 15, "maxAge": 17 },
    { "id": "senior", "label": "Senior", "minAge": 18, "maxAge": 40 }
  ],
  "circuitRules": [
    {
      "circuitLevel": "club_tournament",
      "ageCategory": "senior",
      "rounds": 3,
      "roundDurationMinutes": 3,
      "restDurationMinutes": 1,
      "scoringSystem": "10_point_must",
      "headgearRequired": true,
      "gloveWeightOz": 10,
      "standingEightCount": true,
      "threeKnockdownRule": true,
      "maxBoutsPerDay": 2,
      "description": "Standard LBF senior amateur rules for club competition."
    }
  ]
}
```

Include rules for all combinations of:
- Circuit levels: `club_tournament`, `regional_open`, `national_championship`
- Age categories: `junior`, `youth`, `senior`

Junior and youth have shorter rounds (3x2 minutes). Senior club and regional are 3x3. Nationals senior are 3x3. Headgear required at all levels. `maxBoutsPerDay`: nationals = 1, club card = 2.

---

### `international/boxing/eubc-rules.json`

Same structure as LBF rules. `sanctioningBodyId: "eubc"`.

Circuit levels covered: `baltic_championship`, `european_championship`.

EUBC elite senior: 3 rounds x 3 minutes. Youth: 3x2. Junior: 3x2. Headgear required at youth/junior, not required at elite senior level (EUBC removed headgear for elite men in 2013). `maxBoutsPerDay`: 1 for all EUBC events.

---

### `international/boxing/iba-rules.json`

Same structure. `sanctioningBodyId: "iba"`.

Circuit levels covered: `world_championship`, `olympics`.

IBA/Olympic senior men: 3 rounds x 3 minutes. No headgear for elite men. Computerised scoring at Olympics. `maxBoutsPerDay`: 1. `scoringSystem`: `"10_point_must"` for world championships, `"10_point_must_computerised"` for Olympics.

---

## Part 3 — TypeScript Types

### `src/types/competition.ts`

New file. All competition structure types. No fight simulation types — those come with the fight engine.

```typescript
// competition.ts defines the structural containers for boxing competition.
// Bouts, cards, brackets, and multi-day events are containers — they hold
// fighter assignments and results but contain no simulation logic.
// The fight engine fills these containers when events run.

// ─── Bout ────────────────────────────────────────────────────────────────────

export type BoutStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_contest'

export type BoutMethod =
  | 'ko'
  | 'tko'
  | 'decision'
  | 'technical_decision'
  | 'no_contest'
  | 'draw'

export interface JudgeScorecard {
  judgeId: string
  fighterAScore: number
  fighterBScore: number
}

export interface BoutResult {
  winnerId: string | null       // null = draw or no_contest
  method: BoutMethod
  endRound: number
  judgeScores?: JudgeScorecard[]
}

export interface Bout {
  id: string
  eventId: string
  circuitLevel: string
  weightClassId: string
  ageCategoryId: string
  fighterAId: string
  fighterBId: string
  gymAId: string
  gymBId: string
  scheduledRounds: number
  status: BoutStatus
  result?: BoutResult
  // roundResults added by fight engine when bout runs — not defined here
}

// ─── Card ────────────────────────────────────────────────────────────────────

// A card is a collection of individual bouts on the same night.
// No bracket advancement — each bout is independent.
// Club tournaments use card format.

export type CardVisibility = 'private' | 'public'
// private: club card — player knows their bout, sees results as they happen
// public: regional+ — full card announced in advance

export interface Card {
  id: string
  eventId: string
  boutIds: string[]             // ordered list — fight order matters for atmosphere
  visibility: CardVisibility
}

// ─── Tournament Bracket ───────────────────────────────────────────────────────

// A tournament bracket is a structured advancement competition.
// Fighters advance through rounds — quarterfinals, semifinals, final.
// Regional opens, nationals, and all international events use bracket format.

export interface TournamentEntrant {
  fighterId: string
  gymId: string
  nationId: string
  seed?: number                 // seeded at nationals based on ranking points
}

export interface TournamentRound {
  roundNumber: number           // 1 = quarterfinal, 2 = semi, 3 = final
  label: string                 // "Quarterfinals", "Semifinals", "Final"
  day: number                   // which day of a multi-day event
  boutIds: string[]
}

export interface TournamentBracket {
  id: string
  eventId: string
  weightClassId: string
  ageCategoryId: string
  entrants: TournamentEntrant[]
  rounds: TournamentRound[]
  winnerId?: string
  status: 'open'                // open = accepting entrants
         | 'closed'             // closed = bracket generated, no more entries
         | 'in_progress'
         | 'completed'
}

// ─── Multi-day Event ──────────────────────────────────────────────────────────

// Multi-day events (nationals, international championships) run across
// multiple days. Each day has its own session of bouts.
// Day 1 = quarterfinals, Day 2 = semifinals, Day 3 = finals.

export interface MultiDayEvent {
  eventId: string
  days: MultiDaySession[]
}

export interface MultiDaySession {
  dayNumber: number
  year: number
  week: number
  dayOfWeek: number             // 1=Mon, 7=Sun
  bracketIds: string[]          // one bracket per weight class per day
}

// ─── Rules ───────────────────────────────────────────────────────────────────

export type ScoringSystem =
  | '10_point_must'
  | '10_point_must_computerised'

export interface AgeCategory {
  id: string
  label: string
  minAge: number
  maxAge: number
}

export interface CircuitRules {
  circuitLevel: string
  ageCategory: string
  rounds: number
  roundDurationMinutes: number
  restDurationMinutes: number
  scoringSystem: ScoringSystem
  headgearRequired: boolean
  gloveWeightOz: number
  standingEightCount: boolean
  threeKnockdownRule: boolean
  maxBoutsPerDay: number
  description: string
}

export interface RulesData {
  meta: Meta
  sanctioningBodyId: string
  ageCategories: AgeCategory[]
  circuitRules: CircuitRules[]
}
```

Export from `src/types/index.ts`.

---

## Part 4 — Update Loader

**Update `src/data/loader.ts`**

Add rules loading to `NationBoxingData`:

```typescript
export interface NationBoxingData {
  sanctioningBodies: SanctioningBodiesData
  amateurCircuit: AmateurCircuitData
  eventTemplates: EventTemplatesData
  venues: VenuesData
  rules: RulesData              // new
}
```

Add rules loading to `InternationalData.boxing`:

```typescript
boxing: {
  sanctioningBodies: SanctioningBodiesData
  circuits: InternationalCircuitsData
  eventTemplates: EventTemplatesData
  venues: VenuesData
  eubcRules: RulesData          // new
  ibaRules: RulesData           // new
}
```

Loader reads `nations/latvia/boxing/lbf-rules.json` and `international/boxing/eubc-rules.json` + `international/boxing/iba-rules.json`.

---

## Part 5 — SQLite Tables

**Update `packages/desktop/src/db.ts`**

```sql
-- bouts: one row per scheduled or completed bout
CREATE TABLE IF NOT EXISTS bouts (
  id TEXT NOT NULL,
  saveId TEXT NOT NULL,
  eventId TEXT NOT NULL,
  circuitLevel TEXT NOT NULL,
  weightClassId TEXT NOT NULL,
  ageCategoryId TEXT NOT NULL,
  fighterAId TEXT NOT NULL,
  fighterBId TEXT NOT NULL,
  gymAId TEXT NOT NULL,
  gymBId TEXT NOT NULL,
  scheduledRounds INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  result TEXT,                  -- JSON serialised BoutResult, null until complete
  PRIMARY KEY (id, saveId),
  FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
);

-- cards: collection of bouts for a card-format event
CREATE TABLE IF NOT EXISTS cards (
  id TEXT NOT NULL,
  saveId TEXT NOT NULL,
  eventId TEXT NOT NULL,
  boutIds TEXT NOT NULL DEFAULT '[]',   -- JSON array
  visibility TEXT NOT NULL DEFAULT 'private',
  PRIMARY KEY (id, saveId),
  FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
);

-- tournament_brackets: one bracket per weight class per tournament event
CREATE TABLE IF NOT EXISTS tournament_brackets (
  id TEXT NOT NULL,
  saveId TEXT NOT NULL,
  eventId TEXT NOT NULL,
  weightClassId TEXT NOT NULL,
  ageCategoryId TEXT NOT NULL,
  entrants TEXT NOT NULL DEFAULT '[]',  -- JSON array of TournamentEntrant
  rounds TEXT NOT NULL DEFAULT '[]',    -- JSON array of TournamentRound
  winnerId TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  PRIMARY KEY (id, saveId),
  FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
);

-- multi_day_events: day structure for nationals and international events
CREATE TABLE IF NOT EXISTS multi_day_events (
  eventId TEXT NOT NULL,
  saveId TEXT NOT NULL,
  days TEXT NOT NULL DEFAULT '[]',      -- JSON array of MultiDaySession
  PRIMARY KEY (eventId, saveId),
  FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
);
```

Export typed functions:
```typescript
export function saveBout(db: Database, saveId: string, bout: Bout): void
export function getBout(db: Database, saveId: string, boutId: string): Bout | null
export function saveCard(db: Database, saveId: string, card: Card): void
export function saveTournamentBracket(db: Database, saveId: string, bracket: TournamentBracket): void
export function getTournamentBrackets(db: Database, saveId: string, eventId: string): TournamentBracket[]
export function saveMultiDayEvent(db: Database, saveId: string, event: MultiDayEvent): void
```

---

## Part 6 — Bracket Generation

**`packages/engine/src/generation/bracket.ts`**

```typescript
// generateBracket produces an empty TournamentBracket from a list of entrants.
// Brackets are generated when an event week arrives and entry is closed —
// not at calendar creation time. The bracket contains fighter assignments
// but no results — the fight engine fills results when the event runs.
//
// Bracket sizing rules:
// - 2 entrants: 1 round (final only)
// - 3-4 entrants: 2 rounds (semis + final)
// - 5-8 entrants: 3 rounds (quarters + semis + final)
// - 9-16 entrants: 4 rounds
// Byes are assigned to lower seeds when entrant count is not a power of 2.
//
// Seeding: if entrants have seed values, higher seeds avoid each other
// until the final. Unseeded entrants are randomly distributed.

export function generateBracket(
  eventId: string,
  weightClassId: string,
  ageCategoryId: string,
  entrants: TournamentEntrant[],
  daysStructure: { day: number; label: string; roundNumber: number }[],
  rng: RNG
): TournamentBracket
```

Bracket assigns bout ids deterministically from seed. Same seed + same entrants = same bracket every time.

Byes — when entrant count is not a power of 2, assign byes to lowest seeds. A bye means the fighter advances automatically without fighting. Store as a bout with `fighterBId: 'bye'`.

Comment why bracket sizing follows powers of 2 and why byes go to lowest seeds.

**`packages/engine/src/generation/bracket.test.ts`**

Tests:
- 4 entrants produces correct 2-round bracket
- 8 entrants produces correct 3-round bracket
- 5 entrants produces correct bracket with 3 byes
- Same seed + same entrants = same bracket (determinism)
- Higher seeds don't meet until later rounds
- All entrants appear exactly once in round 1

---

### Definition Of Done
- [ ] `amateur-circuit.json` — `club_tournament` format corrected to `card`, nationals has `daysStructure`
- [ ] `international/boxing/circuits.json` — all international levels have `multiDay` and `daysStructure`
- [ ] `lbf-rules.json` — all circuit levels × age categories covered
- [ ] `eubc-rules.json` — Baltic and European covered
- [ ] `iba-rules.json` — World and Olympics covered, computerised scoring on Olympics
- [ ] `src/types/competition.ts` — all types defined, exported
- [ ] Loader updated — rules loaded for LBF, EUBC, IBA
- [ ] SQLite tables created — bouts, cards, tournament_brackets, multi_day_events
- [ ] db.ts — all typed functions exported
- [ ] `src/generation/bracket.ts` — generates correct empty brackets
- [ ] `src/generation/bracket.test.ts` — all tests passing
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: competition infrastructure — rules, types, sqlite, bracket generation`

### Notes
- No fight simulation — bouts are containers, results are empty until fight engine runs
- Bracket generation happens at event time, not calendar creation time
- `fighterBId: 'bye'` for bye assignments — simple, unambiguous
- EUBC removed headgear for elite men in 2013 — headgearRequired: false for senior European/World/Olympics
- Comment why on every non-obvious decision in bracket.ts
- Rules files must cover every combination of circuit level + age category used in Latvia
