# Current Task

## Task: Gym Names Data + generateGym + generateWorld Update

### What To Build
One data file, one new generation function, and an update to generateWorld. After this session the world generates with real gyms populated with real people — some of whom are fighters.

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## Part 1 — Gym Names Data

**`packages/engine/data/nations/latvia/gym-names.json`**

Realistic Latvian boxing gym names for procedural world generation. The engine picks from this pool when generating rival gyms. Names follow real Latvian gym naming patterns.

Meta must explain: names are used by the engine when generating gyms during world creation. The player's gym name comes from the new game config — not from this pool. Research real Latvian boxing gym naming conventions: city/neighbourhood + "Boksa klubs", founder surnames, district names, historical references. Mix of Latvian and Russian-influenced names reflecting Latvia's demographics.

Structure:
```json
{
  "meta": { ... },
  "patterns": {
    "cityPrefix": ["Rīgas", "Daugavpils", "Liepājas", "Jelgavas", "Valmieras", "Rēzeknes"],
    "suffixes": ["Boksa klubs", "Boksas skola", "Boxing Club", "Fight Club", "BC"],
    "standalone": ["Dinamo", "Lokomotīve", "Spartaks", "Olimps", "Čempions", "Lauvas", "Ērglis"]
  },
  "fullNames": [
    "Rīgas Boksa klubs",
    "Daugavpils Boksas skola",
    "Dinamo Rīga BC",
    "Spartaks Daugavpils",
    ...minimum 40 full names total
  ]
}
```

The engine uses `fullNames` pool primarily. `patterns` are for procedural combination when the pool is exhausted.

---

## Part 2 — generateGym

**`packages/engine/src/generation/gym.ts`**

```typescript
// generateGym produces a complete Gym from a starting state template.
// City modifiers from cities.json are applied to rent and affect
// the starting financial state.
//
// Generation order:
// 1. Select template based on city population type and city distribution weights
// 2. Roll physical space — total square meters, zone conditions
// 3. Generate starting equipment from template equipment list
// 4. Calculate starting finances — rent modified by city rentModifier
// 5. Generate gym name from gym-names pool
// 6. Initialise staff as empty — populated separately when persons are assigned
// 7. Initialise quality score from zone conditions and equipment
// 8. Initialise culture at neutral values
// 9. Set kids class as inactive by default

export function generateGym(
  cityId: string,
  nationId: string,
  isPlayerGym: boolean,
  gymName: string | null,   // null = pick from names pool
  data: GameData,
  rng: RNG,
  options?: GymGenerationOptions
): Gym

export interface GymGenerationOptions {
  forceTemplateId?: string   // override template selection — used for player gym
}
```

### Generation Rules

**Template selection:**
- If `isPlayerGym` → force `rundown_community`
- Otherwise → look up city population type from cities data, weighted pick from `cityDistribution`

**Physical space:**
- Roll `totalSquareMeters` from template range
- For each zone in template: if `exists`, roll `condition` from template range, assign square meters proportionally from total
  - Training floor gets 50% of total square meters
  - Strength room gets 20%
  - Changing rooms get 15%
  - Reception gets 10%
  - Storage gets remaining 5% if it exists
  - Optional zones (videoAnalysisRoom) get carved from training floor allocation

**Equipment generation:**
- For each item in template `startingEquipment`: roll count if range, roll condition from range
- Create a `GymEquipmentItem` per unit with unique id, purchasedYear/Week set to world start year minus random 1-5 years (equipment pre-dates the player arriving)
- Check square meter constraint — if adding equipment would exceed zone capacity, skip it

**Finances:**
- `monthlyRent` = template base rent × city `rentModifier`
- `balance` = roll from template `startingBalance` range
- `membershipFeeMonthly` = roll from template range
- `loanAmount` = 0 (no starting debt except negative balance)
- Revenue history starts empty

**Gym name:**
- If `isPlayerGym` or `gymName` provided — use that name
- Otherwise — weighted pick from `fullNames` pool, ensure no duplicate name within same city

**Quality calculation:**
- Call `calculateGymQuality(gym)` after generation to set initial quality scores
- `hasRing` = any equipment item with typeId `boxing_ring` and condition > 0
- `ringCount` = count of usable boxing rings
- `maxTrainingCapacity` = floor(trainingFloor.squareMeters / 4)
- Zone quality = weighted average of equipment condition values for that zone's equipment
- Overall = 50% training floor + 20% strength + 10% changing + 10% reception + 10% other

**Culture initialisation:**
```typescript
culture: {
  atmosphereScore: rng.nextInt(30, 60),    // neutral starting atmosphere
  sparringIntensity: rng.nextInt(30, 60),  // neither soft nor brutal
  memberCohesion: rng.nextInt(40, 65),
  coachingFocus: null,                     // emerges from coach over time
  reputationTone: null                     // emerges after sufficient history
}
```

**Kids class:**
```typescript
kidsClass: {
  active: false,
  instructorPersonId: null,
  monthlyFee: 0,
  currentEnrolment: 0,
  maxEnrolment: 0,
  cohortHistory: []
}
```

**Export helper:**
```typescript
// calculateGymQuality derives the current quality scores from zone and equipment state.
// Called after generation and after any equipment condition change or zone update.
// Never stores raw zone/equipment state — always recalculates from current reality.
export function calculateGymQuality(gym: Gym, data: GameData): GymQuality
```

---

## Part 3 — generateWorld Update

**Update `packages/engine/src/generation/world.ts`**

Current `generateWorld` generates persons and a world structure but gyms are empty placeholders. Update it to:

### Step 1 — Generate gyms per city

For each city in each rendered nation:
```typescript
// Number of gyms per city comes from game config worldSettings.gymsPerCity
// multiplied by the city's rivalGymDensity modifier.
// Always at least 1 gym per city (player's city always has the player gym).
const gymCount = Math.max(1, Math.round(
  config.worldSettings.gymsPerCity[city.population] * city.rivalGymDensity
))
```

For the player's starting city: first gym is player gym (`isPlayerGym: true`, name from `config.gymName`). Rest are rival gyms.

For all other cities: all gyms are rival gyms.

### Step 2 — Distribute persons into gyms

After generating all persons for a city, distribute them across that city's gyms:

```typescript
// Distribution rules:
// - Each gym has a soft capacity: gym.lockerCount
// - Persons are assigned to gyms using weighted random — larger gyms attract more members
// - Weight = gym.lockerCount (bigger gym = more likely to attract members)
// - Distribution stops when lockerCount is reached for a gym
// - Persons who don't fit in any gym are free agents (currentGymId = null on their fighter record)
// - Free agents still exist in the city population — they just train independently or not at all
```

### Step 3 — Identify fighters within gyms

For each person assigned to a gym, determine if they should be generated as a Fighter:

```typescript
// Not every gym member is a Fighter.
// Generation rules:
// - If person's reasonForBoxingId is 'outlet', 'fell_into_it', or 'friend_brought_me'
//   AND soul traits include 'content' → 80% chance they are NOT a fighter (just a regular)
// - If person's reasonForBoxingId is 'way_out', 'prove_something', or 'passion' → always a Fighter
// - Otherwise → 60% chance they are a Fighter
//
// Fighters are generated using generateFighter(person, gymId, null, data, rng)
// coachId is null at this stage — coaches are assigned in a separate pass
```

Update gym's `memberIds` and `fighterIds` arrays accordingly.

### Step 4 — Assign initial staff

For each gym, assign a head coach from its fighter population:
```typescript
// Simple rule for world generation:
// Pick the fighter in the gym with the highest combined developed attributes
// who is NOT in 'competing' fighter identity state and is age > 28.
// Mark them as head coach (isGymMemberFilling: true, role: 'head_coach').
// If no eligible fighter exists, gym has no head coach at world start.
// wageMonthly = 0 for gym member filling role.
```

### Step 5 — Update WorldState

WorldState currently has `gyms: Record<string, GymState>` with a lightweight GymState stub. Update this to store full Gym objects. Update the SQLite schema accordingly.

```typescript
// WorldState.gyms stores full Gym objects keyed by gym id.
// Persons are stored separately in the persons SQLite table.
// The gym record stores memberIds and fighterIds as string arrays — 
// actual Person/Fighter records are in the persons table.
```

### Step 6 — Update return type and SQLite saving

```typescript
export function generateWorld(config: GameConfig, data: GameData): {
  worldState: WorldState
  persons: Person[]
  fighters: Fighter[]
  gyms: Gym[]
  calendar: CalendarEvent[]
}
```

Update `packages/desktop/src/ipc.ts` `generate-and-save` handler to also save gyms to SQLite.

Add gyms table to `packages/desktop/src/db.ts`:
```sql
CREATE TABLE IF NOT EXISTS gyms (
  id TEXT NOT NULL,
  saveId TEXT NOT NULL,
  data TEXT NOT NULL,   -- JSON serialised Gym
  cityId TEXT NOT NULL,
  nationId TEXT NOT NULL,
  isPlayerGym INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id, saveId),
  FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
);
```

Export typed functions:
```typescript
export function saveGyms(db: Database, saveId: string, gyms: Gym[]): void
export function loadGyms(db: Database, saveId: string): Gym[]
export function getPlayerGym(db: Database, saveId: string): Gym | null
export function getGymsByCity(db: Database, saveId: string, cityId: string): Gym[]
```

---

## Part 4 — Tests

**`packages/engine/src/generation/gym.test.ts`**

Tests:
- Player gym always uses rundown_community template
- Generated gym has all required Gym interface fields
- `monthlyRent` is base template rent × city rentModifier
- Training floor capacity = floor(trainingFloor.squareMeters / 4)
- `hasRing` false when no boxing_ring in equipment
- `hasRing` true when boxing_ring exists with condition > 0
- Equipment count within template min/max ranges
- Same seed → same gym (determinism)
- Gym name not duplicated within same city

**Update `packages/engine/src/generation/world.test.ts`**

Add tests:
- World generates correct number of gyms per city based on gymsPerCity config × rivalGymDensity
- Player city has exactly one player gym
- All other gyms have isPlayerGym false
- Every gym has at least one member
- Total persons distributed = total persons generated (no person lost)
- Free agents exist when gym capacity is exceeded

---

### Definition Of Done
- [ ] `gym-names.json` — minimum 40 full names, patterns defined, valid JSON
- [ ] `src/generation/gym.ts` — generateGym + calculateGymQuality
- [ ] `src/generation/gym.test.ts` — all listed tests passing
- [ ] `src/generation/world.ts` — gyms generated, persons distributed, fighters identified, staff assigned
- [ ] `src/generation/world.test.ts` — new tests passing, existing tests still passing
- [ ] `db.ts` — gyms table, saveGyms, loadGyms, getPlayerGym, getGymsByCity
- [ ] `ipc.ts` — generate-and-save saves gyms
- [ ] `generateWorld` return type updated
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing — all existing 100 tests still pass
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: gym names + generateGym + world population`

### Notes
- Read engine skill fully before writing any code
- City modifiers: rentModifier on finances, rivalGymDensity on gym count, talentDensity used in person count (already in generateWorld)
- Free agents are valid — persons who don't fit in any gym remain in the world without a gym assignment
- Head coach assignment in world gen is simple (oldest non-competing fighter) — real coaching assignment comes with the full staff system
- calculateGymQuality must be exported — it will be called by the engine after any equipment change
- Comment why on every non-obvious generation decision
