# Current Task

## Task: advanceWeek + World Backrun

### What To Build
A working `advanceWeek()` function and the world backrun engine that calls it 520 times to generate 10 years of boxing history before the player arrives. After this session the game has a real world to drop the player into.

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## Architecture

```
backrun(worldState, persons, fighters, gyms, coaches, calendar, data, rng)
  → calls advanceWeek() 520 times
  → returns populated world with 10 years of history

advanceWeek(state, data, rng)
  → weeklyTick (decay, finances, inactivity)
  → identityTick (fighter identity state transitions)
  → eventTick (resolve events scheduled this week)
  → returns updated state
```

All simulation in memory. SQLite writes happen in batches at the end of each simulated year — not every week. This keeps the backrun fast.

---

## Part 1 — Weekly Tick Types

**`packages/engine/src/types/advanceWeek.ts`**

```typescript
// Types for the weekly simulation tick.
// AdvanceWeekState is the full in-memory world state during simulation.
// Passed into advanceWeek(), mutated, returned.
// Never stored to SQLite mid-simulation — only written in year-end batches.

export interface AdvanceWeekState {
  year: number
  week: number                    // 1-52
  worldState: WorldState
  persons: Map<string, Person>
  fighters: Map<string, Fighter>
  gyms: Map<string, Gym>
  coaches: Map<string, Coach>
  calendar: CalendarEvent[]
  // Accumulated changes since last SQLite write
  pendingBoutResults: BoutResolutionResult[]
  pendingAttributeEvents: Map<string, AttributeHistoryEvent[]>  // fighterId → events
  pendingFighterUpdates: Set<string>   // fighter ids that need SQLite update
  pendingGymUpdates: Set<string>
}

export interface AdvanceWeekResult {
  state: AdvanceWeekState
  eventsProcessed: number
  boutsResolved: number
  identityTransitions: number
}

export interface BackrunProgress {
  year: number
  boutsSimulated: number
  identityTransitions: number
  message: string
}
```

Add to `src/types/index.ts`.

---

## Part 2 — Coach Entry Decision

**`packages/engine/src/engine/coachEntryDecision.ts`**

```typescript
// coachEntryDecision determines whether a coach enters a fighter
// into a specific event. Used by the backrun and eventually by
// live play when the player delegates decisions.
//
// For the backrun, this is intentionally simple — the full coaching
// AI that live play uses will build on this foundation.
//
// Decision factors:
// - Fighter readiness threshold (coach quality affects threshold)
// - Fighter competition status (unregistered fighters cannot enter)
// - Inactivity (fighters idle too long need conditioning first)
// - Event circuit level vs fighter development level (a coach
//   doesn't enter a raw beginner in the national championship)

export function coachShouldEnterFighter(
  fighter: Fighter,
  event: CalendarEvent,
  coach: Coach | null,
  data: GameData
): boolean
```

### Decision rules:

```
// Unregistered fighters cannot compete in any official event
if fighter.competition.status === 'unregistered' → false

// Fighter must be in aspiring or competing identity state
if fighter.fighterIdentity.state not in ['aspiring', 'competing'] → false

// Inactivity check — fighters who haven't trained recently aren't ready
if fighter.career.lastBoutYear !== null:
  weeksSinceLastBout = calculateWeeksSince(fighter.career.lastBoutYear, fighter.career.lastBoutWeek, state.year, state.week)
  if weeksSinceLastBout > 104 → false  // 2 years inactive, skip

// Readiness threshold — varies by coach quality
// Poor coach (quality 1-5): enters fighters at readiness >= 30 (desperate for experience)
// Average coach (quality 6-10): enters fighters at readiness >= 45
// Good coach (quality 11-15): enters fighters at readiness >= 55
// Elite coach (quality 16-20): enters fighters at readiness >= 65
// No coach: threshold is 35 (gym member filling role or no coach)
const threshold = coachReadinessThreshold(coach)
if fighter.career.readiness < threshold → false

// Circuit level appropriateness
// club_card: any fighter above threshold
// regional_tournament: fighter must have at least 1 amateur bout
// national_championship: fighter must have at least 3 amateur bouts
// Beyond national: fighter must have won at regional level
const minimumBouts = minimumBoutsForCircuit(event.circuitLevel)
if totalAmateurBouts(fighter) < minimumBouts → false

return true
```

---

## Part 3 — Weekly Tick Functions

**`packages/engine/src/engine/weeklyTick.ts`**

```typescript
// weeklyTick handles all non-event updates that happen every week:
// equipment decay, gym finances, fighter inactivity tracking,
// attribute regression for inactive fighters.
//
// These run regardless of whether there are events this week.
// Keeps the world alive between fights.

export function runWeeklyTick(state: AdvanceWeekState, data: GameData, rng: RNG): void
```

### What it does:

**Equipment decay:**
```typescript
// For each gym, for each equipment item:
// item.condition -= equipmentType.conditionDecayPerWeek
// clamp to minimum 0
// if condition drops below 20 — flag for maintenance (surfaces as inbox event in live play)
// For backrun: just decay, no inbox events
```

**Gym finances:**
```typescript
// Weekly income = (memberCount × monthlyMembershipFee) / 4
// Weekly outgoings = (monthlyRent + totalStaffWages) / 4
// gym.finances.balance += income - outgoings
// Update gym.finances.lastUpdatedYear/Week
// Track in revenueHistory — one record per month (every 4 weeks)
```

**Fighter inactivity:**
```typescript
// For each fighter in competing or aspiring state:
// If lastBoutYear is null or weeks since last bout > inactivityThreshold:
//   apply regression rates from attribute-accumulation.json
//   rate depends on competition.status (amateur/pro)
// Update pendingAttributeEvents and pendingFighterUpdates
```

**Age advancement:**
```typescript
// Every 52 weeks: increment person.age for all persons
// Check physical genetic regression for fighters over 32
// Apply age regression rates from attribute-accumulation.json physicalGeneticRegression
```

---

## Part 4 — Identity Tick

**`packages/engine/src/engine/identityTick.ts`**

```typescript
// identityTick advances fighter identity states each week.
// Not every fighter transitions every week — probabilities are low.
// But over 10 years small probabilities produce a realistic distribution
// of fighters at different stages.
//
// Transitions:
// unaware → curious: low probability, triggered by witnessing gym activity
// curious → aspiring: medium probability, triggered by time + soul traits
// aspiring → competing: requires registration + coach decision + readiness
// competing → retired: triggered by age, health, or repeated losses

export function runIdentityTick(state: AdvanceWeekState, data: GameData, rng: RNG): number
// returns count of transitions this week
```

### Transition probabilities:

```typescript
// unaware → curious
// Base probability: 0.5% per week (about 25% chance per year)
// Multipliers:
//   hungry soul trait: × 2.0
//   reason_for_boxing is way_out or prove_something: × 1.5
//   gym has fighters with winning records: × 1.3
//   content soul trait: × 0.3
const unawareToCuriousProb = 0.005 × traitMultiplier × gymMultiplier

// curious → aspiring
// Base probability: 1% per week
// Multipliers:
//   hungry: × 2.0
//   years training > 1: × 1.5
//   witnessed a bout at their gym: × 1.8 (check if gym has fighters with bouts)
//   brave: × 1.3
//   craven: × 0.5
const curiousToAspiringProb = 0.01 × multipliers

// aspiring → competing (registration)
// Requires: readiness >= 40, coach decides to enter them in an event
// Not a probability — happens when coachShouldEnterFighter returns true
// and the fighter successfully enters an event

// competing → retired
// Age >= 38: base 5% per week
// Age >= 35 AND health heavily damaged: 3% per week
// 3 consecutive losses: 1% per week
// Voluntary: soul trait content + no title ambitions + age >= 32: 0.5% per week
```

---

## Part 5 — Event Tick

**`packages/engine/src/engine/eventTick.ts`**

```typescript
// eventTick checks the calendar for events this week and resolves them.
// For the backrun, all event resolution is statistical — no exchange logs.
// Uses coachShouldEnterFighter to populate events with real fighters.
// Uses resolveBout for all bout outcomes.

export function runEventTick(state: AdvanceWeekState, data: GameData, rng: RNG): number
// returns count of bouts resolved this week
```

### Event resolution flow:

**Club card:**
```typescript
// 1. Find all fighters in gyms within this city that pass coachShouldEnterFighter
// 2. Group by weight class
// 3. Match fighters in each weight class — pair by similar record/readiness
// 4. For each matched pair: resolveBout()
// 5. Update fighter records, apply attribute events
// 6. Update gym reputation: +1 local rep per win, +3 per dominant win
// 7. Mark first-time competitors as status 'amateur', update competition.status
// 8. Register fighters with sanctioning body if not already registered
```

**Regional tournament:**
```typescript
// 1. Collect entrants from all cities in the region
// 2. Group by weight class, generateBracket per weight class
// 3. Resolve bracket round by round using resolveBout()
// 4. Award medals to gold/silver/bronze
// 5. Update amateur rankings for this sanctioning body
// 6. Apply attribute events — tournament fights give more than single bouts
```

**National championship:**
```typescript
// Same as regional but:
// - Entrants from all cities in the nation
// - Only fighters who have competed at regional level
// - Title awarded to gold medallist per weight class
// - Significant reputation boost for gym
// - Fighter identity check: national champion may have ambitions elevated
```

**Pro card (when ecosystem level >= 1):**
```typescript
// 1. Check if any Latvian promoter has generated a card this week
// 2. Promoter AI: match fighters by ranking and record similarity
// 3. resolveBout() for each bout
// 4. Update pro records, rankings
// 5. Check pro ecosystem thresholds
```

---

## Part 6 — advanceWeek Orchestrator

**`packages/engine/src/engine/advanceWeek.ts`**

Replace the stub with full implementation:

```typescript
// advanceWeek is the single tick of the simulation.
// Called 520 times by the backrun to generate 10 years of history.
// Called once per in-game week during live play.
//
// Order matters:
// 1. weeklyTick — decay, finances, inactivity (always runs)
// 2. identityTick — state transitions (always runs)
// 3. eventTick — event resolution (only if events scheduled this week)
//
// For the backrun: no inbox events, no moments, no player notifications.
// For live play: advanceWeek will eventually surface results to the inbox.
// The flag isBackrun suppresses all player-facing outputs.

export function advanceWeek(
  state: AdvanceWeekState,
  data: GameData,
  rng: RNG,
  isBackrun: boolean = false
): AdvanceWeekResult
```

Week/year advancement:
```typescript
// After running all ticks:
state.week += 1
if state.week > 52:
  state.week = 1
  state.year += 1
  // Year-end batch write to SQLite (backrun only)
  // Age advancement for all persons
```

---

## Part 7 — Backrun Engine

**`packages/engine/src/generation/backrun.ts`**

```typescript
// backrun simulates 10 years of boxing history before the player arrives.
// Calls advanceWeek() 520 times starting from (startYear - 10).
// All simulation in memory — SQLite writes in year-end batches.
//
// The same advanceWeek() used here is used during live play.
// The only difference is isBackrun=true suppresses player-facing outputs.
//
// Progress callback allows the loading screen to show meaningful updates.
// "Year 2018 — 47 bouts simulated, 12 identity transitions"

export async function runBackrun(
  worldState: WorldState,
  persons: Person[],
  fighters: Fighter[],
  gyms: Gym[],
  coaches: Coach[],
  calendar: CalendarEvent[],
  data: GameData,
  config: GameConfig,
  db: Database,
  onProgress?: (progress: BackrunProgress) => void
): Promise<AdvanceWeekState>
```

### Backrun flow:

```typescript
// 1. Build AdvanceWeekState from generated world
// 2. Set year = config.startYear - 10, week = 1
// 3. for each of 520 weeks:
//    a. advanceWeek(state, data, rng, isBackrun=true)
//    b. if week === 52: batchWriteToSQLite(state, db, saveId)
//    c. onProgress({ year, boutsSimulated, message })
// 4. Final batch write of remaining pending changes
// 5. Return final state
```

### Batch write:
```typescript
// batchWriteToSQLite writes all pending changes accumulated over the year.
// Clears pending sets after writing.
// Write order: persons → fighters → gyms → coaches → bouts → calendar events
// Use SQLite transactions for each batch — all or nothing per year.
function batchWriteToSQLite(state: AdvanceWeekState, db: Database, saveId: string): void
```

---

## Part 8 — Wire Into IPC

**Update `packages/desktop/src/ipc.ts`**

Update `generate-and-save` handler to run backrun after world generation:

```typescript
// generate-and-save flow:
// 1. loadGameData()
// 2. generateWorld(config, data) → worldState, persons, fighters, gyms, coaches, calendar
// 3. Save initial world to SQLite
// 4. runBackrun(..., onProgress: send progress to renderer via IPC)
// 5. Save final backrun state to SQLite
// 6. Return saveId to renderer

// Progress IPC: emit 'backrun-progress' event with BackrunProgress data
// Loading screen listens for this and updates the progress bar
```

**Update `packages/ui/src/screens/Loading.tsx`**

Listen for `backrun-progress` IPC events. Display:
```
Generating world history...
Year 2018 · 47 bouts simulated
████████████░░░░░░░░  60%
```

Show year, bouts simulated this year, overall progress percentage.

---

## Part 9 — Tests

**`packages/engine/src/engine/advanceWeek.test.ts`**

Tests:
- Week advances correctly — week 52 rolls to week 1 of next year
- Equipment condition decays each week
- Gym finances update each week — balance reflects income minus outgoings
- Fighter in inactive state past threshold shows attribute regression events
- Identity transition: unaware fighter can become curious over time
- Club card event resolves bouts between matched fighters
- Fighter records update after bout resolution
- coachShouldEnterFighter returns false for unregistered fighter
- coachShouldEnterFighter returns false for fighter below readiness threshold
- coachShouldEnterFighter returns true for ready competing fighter
- Backrun produces fighters with non-zero bout records after 520 weeks
- Backrun is deterministic — same seed produces same history

---

### Definition Of Done
- [ ] `src/types/advanceWeek.ts` — all types, exported
- [ ] `src/engine/coachEntryDecision.ts` — coachShouldEnterFighter with all rules
- [ ] `src/engine/weeklyTick.ts` — decay, finances, inactivity, age
- [ ] `src/engine/identityTick.ts` — all four transitions
- [ ] `src/engine/eventTick.ts` — club card, regional, national, pro card
- [ ] `src/engine/advanceWeek.ts` — full implementation replacing stub
- [ ] `src/generation/backrun.ts` — 520 weeks, batch writes, progress callback
- [ ] IPC updated — backrun runs after world generation, progress events emitted
- [ ] Loading screen updated — shows backrun progress with year and bout count
- [ ] `src/engine/advanceWeek.test.ts` — all listed tests passing
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing — all 165 existing tests still pass
- [ ] `docs/structure.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: advanceWeek + world backrun`

### Notes
- Read engine skill fully before writing any code
- isBackrun=true suppresses all player-facing outputs — no inbox, no moments
- All simulation in memory — never hit SQLite during the weekly tick loop
- Batch writes in year-end transactions — all or nothing per year
- coachShouldEnterFighter is intentionally simple — this is the backrun version
- Week 52 → year rollover must also advance all person ages
- Progress callback must be called after each year with accurate bout count
- resolveBout is already deterministic — backrun determinism comes from consistent RNG usage
- The same advanceWeek used in backrun is used in live play — isBackrun flag is the only difference
