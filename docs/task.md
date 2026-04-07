# Current Task

## Task: Data Loader + Person Type + Person Generation + Tests

### What To Build
The data loader, a fully defined Person type, the person generation function, and tests that verify generation produces valid people. This is the first engine code — read the engine skill before touching anything.

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

### Files To Create / Update

---

**`packages/engine/src/data/loader.ts`**

Reads all JSON data files at startup. Returns a single typed object containing all loaded data. Called once when the engine initialises — not called mid-simulation.

```typescript
// loader.ts loads all game data from JSON files at startup.
// The engine receives this object and uses it throughout the simulation.
// Nothing in the engine reads JSON files directly — only the loader does.

export interface GameData {
  soulTraits: SoulTraitsData
  attributes: AttributesData
  weightClasses: WeightClassesData
  physicalStats: PhysicalStatsData
  health: HealthData
  giftsAndFlaws: GiftsAndFlawsData
  nations: {
    latvia: {
      nation: NationData
      cities: CitiesData
      names: NamesData
      economicStatuses: EconomicStatusesData
      reasonsForBoxing: ReasonsForBoxingData
      coachVoice: {
        attributes: CoachVoiceAttributesData
        physicalStats: CoachVoicePhysicalData
        giftsAndFlaws: CoachVoiceGiftsFlawsData
      }
    }
  }
}

export function loadGameData(): GameData
```

Use `fs.readFileSync` with `JSON.parse`. Paths resolve relative to the data folder. If any file fails to load, throw a descriptive error — fail fast, never silently.

Comment why each section is structured the way it is. Comment why we load everything at startup rather than lazily.

---

**`packages/engine/src/utils/rng.ts`**

Seeded random number generator. All randomness in the engine goes through this — never `Math.random()` directly. Reproducible results for a given seed means saves can be debugged and replayed.

```typescript
// All engine randomness flows through the seeded RNG.
// Using Math.random() directly is forbidden — results would not be
// reproducible across sessions, making saves impossible to debug.

export interface RNG {
  next(): number           // 0 to 1
  nextInt(min: number, max: number): number
  pick<T>(array: T[]): T
  weightedPick<T>(items: T[], weights: number[]): T
}

export function createRng(seed: number): RNG
```

Use a simple seedable algorithm — mulberry32 or xoshiro128** are fine. Comment which algorithm is used and why it was chosen over Math.random().

---

**Update `packages/engine/src/types/person.ts`**

Flesh out the stub that exists from scaffold. A Person is the base — every human in the world starts here.

```typescript
export interface SoulTraitAssignment {
  traitId: string        // references soul-traits.json id
  revealed: boolean      // has the player discovered this trait yet
}

export interface AttributeValue {
  attributeId: string    // references attributes.json id
  current: number        // 1-20, changes over time
  potential: number      // 1-20, set at generation, never changes
}

export interface HealthValue {
  bodyPartId: string     // references health.json id
  integrity: number      // 1-20, baseline set at generation
  damage: number         // accumulated fight damage, starts at 0
}

export interface PhysicalProfile {
  heightCm: number
  reachCm: number
  weightKg: number
  handSize: string       // band id from physical-stats.json
  neckThickness: string
  boneDensity: string
  bodyProportions: string
}

export interface GiftFlawAssignment {
  entryId: string        // references gifts-and-flaws.json id
  type: 'gift' | 'flaw'
  appliesTo: string      // attribute id
  discovered: boolean
}

export interface Person {
  id: string
  name: { first: string; surname: string }
  age: number
  nationId: string
  cityId: string
  economicStatusId: string
  reasonForBoxingId: string
  soulTraits: SoulTraitAssignment[]
  physicalProfile: PhysicalProfile
  health: HealthValue[]
  attributes: AttributeValue[]
  giftsAndFlaws: GiftFlawAssignment[]
}
```

---

**`packages/engine/src/generation/person.ts`**

The person generation function. Takes loaded game data and a seed, returns a fully generated Person.

```typescript
// generatePerson creates a complete person from the game data.
// Generation order matters — each layer feeds the next:
// 1. Identity (nation, city, name, age, background)
// 2. Soul traits (rolled from universal definitions)
// 3. Physical profile (rolled from physical-stats, anchored to weight class)
// 4. Health baseline (rolled from health definitions, nudged by physical profile)
// 5. Gifts and flaws (independent probability rolls per eligible attribute)
// 6. Attributes (rolled within generationMax, modified by physical profile,
//    health, gifts and flaws — potential set here, current starts equal to potential
//    then reduced by age factor)

export function generatePerson(data: GameData, rng: RNG, nationId: string, cityId: string): Person
```

Key rules:
- Generation order must follow the comment above — attributes come last because they depend on everything else
- Gift-eligible attributes cap at 18 at generation unless a gift was rolled — then cap is 20
- Non-gift attributes generate up to 20 naturally
- Current value starts equal to potential then reduced by an age factor — a 16 year old has lower current than potential, a 28 year old at peak has current near potential
- Nation physicalProfile overrides apply when rolling physical profile bands — merge nation overrides with universal defaults before rolling
- All rolls go through the RNG — no Math.random() anywhere
- Comment every section explaining why that order and why that calculation

---

**`packages/engine/src/generation/person.test.ts`**

Tests that verify generation produces valid people. Use Vitest.

Tests to write:
- Generated person has all required fields
- Soul traits — no person has both a trait and its opposite
- Attributes — all values within valid range (1-20)
- Gift-eligible attributes without a gift never exceed 18 at generation
- Gift-eligible attributes with a gift can reach 19-20
- Health integrity values within 1-20
- Physical profile bands are valid ids from physical-stats data
- Name comes from the correct nation name pool
- City belongs to the specified nation
- Deterministic — same seed produces same person every time
- Age factor — a generated 16 year old has lower current attribute values than potential

---

### Definition Of Done
- [ ] `src/data/loader.ts` — loads all files, throws on missing file, fully typed return
- [ ] `src/utils/rng.ts` — seeded, deterministic, no Math.random()
- [ ] `src/types/person.ts` — fully defined, no stubs remaining
- [ ] `src/generation/person.ts` — correct generation order, all rolls through RNG
- [ ] `src/generation/person.test.ts` — all tests listed above written and passing
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — all new files marked `[x]`
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: data loader + person generation + tests`

### Notes
- Read the engine skill fully before writing any code
- Generation order is not optional — attributes must come last
- Comment why on every non-obvious decision — future Claude Code sessions will read these
- The determinism test is critical — if the same seed does not produce the same person the save system will break
- Do not build the Fighter type this session — Person is the base, Fighter extends it later
