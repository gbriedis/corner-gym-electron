# Current Task

## Task: Fighter Type + Fighter Generation

### What To Build
The complete Fighter TypeScript type extending Person, the fighter generation function, and tests. This is the most important type in the game — every system from here builds on it.

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## Part 1 — Fighter Type

**`packages/engine/src/types/fighter.ts`**

Fighter extends Person. Do not duplicate Person fields — import and extend.

```typescript
import type { Person } from './person.js'

// Fighter is a Person who has entered the competitive boxing world.
// Every field on Person remains — Fighter adds what competition requires.
// References:
//   weightClassId      → universal/weight-classes.json
//   attributeId        → universal/attributes.json
//   boutIds            → bouts SQLite table
//   beltId             → international/boxing/pro-title-belts.json
//   sanctioningBodyId  → sanctioning-bodies.json (amateur or pro)
//   promoterId         → universal/promoters.json
//   clauseType         → universal/pro-fight-offer.json
//   gymId              → src/types/gym.ts
//   coachId            → src/types/coach.ts
//   managerId          → src/types/manager.ts
//   circuitLevel       → src/types/data/boxing.ts CircuitLevel

export type FighterIdentityState =
  | 'unaware'     // never considered competing
  | 'curious'     // the question is forming
  | 'aspiring'    // actively wants to compete
  | 'competing'   // has competed, self-identifies as fighter
  | 'retired'     // competed, no longer does

export type RetirementReason =
  | 'voluntary'
  | 'injury'
  | 'age'
  | 'loss_of_drive'

export type CompetitionStatus =
  | 'unregistered'  // never competed officially
  | 'amateur'       // registered with national amateur body
  | 'pro'           // turned professional

export type StyleTendency =
  | 'pressure'
  | 'boxer'
  | 'boxer_puncher'
  | 'brawler'
  | 'counterpuncher'
  | 'swarmer'
  | 'undefined'     // raw fighter, style not yet formed

export type AmbitionLevel =
  | 'undecided'
  | 'local'
  | 'national'
  | 'international'
  | 'olympic'
  | 'world_title'
  | 'undisputed'

export type StagnationState =
  | 'developing'
  | 'plateauing'
  | 'stagnating'

// ─── Sub-interfaces ───────────────────────────────────────────────────────────

export interface FighterIdentity {
  state: FighterIdentityState
  stateChangedYear: number
  stateChangedWeek: number
  retirementReason?: RetirementReason
}

export interface BoxingBackground {
  // Set at generation — never changes.
  // Drives starting developed attribute values.
  yearsTraining: number
  firstTrainedAge: number
  selfTaught: boolean
  priorGymId: string | null
  priorGymNationId: string | null
}

export interface DevelopedAttribute {
  // A developed attribute has both a current value and a generation ceiling.
  // Current value changes through training, fighting, and inactivity.
  // generationCeiling is 18 for gift-eligible attributes (without gift), 20 otherwise.
  // currentPotential is generationCeiling + any gift bonus (max 20 absolute).
  attributeId: string
  current: number
  currentPotential: number    // ceiling after gifts applied — never exceeds 20
  generationCeiling: number   // ceiling at generation — 18 or 20 depending on attribute
}

export interface AttributeHistoryEvent {
  // Records every significant attribute change for history and dev mode analysis.
  year: number
  week: number
  trigger: 'training' | 'sparring' | 'amateur_bout' | 'pro_bout' | 'title_fight' | 'olympic_bout' | 'inactivity' | 'age_regression'
  delta: number               // positive = growth, negative = regression
  oppositionQuality?: number  // 0-100, for bout events
}

export interface AttributeHistory {
  attributeId: string
  baseValue: number           // value at generation
  events: AttributeHistoryEvent[]
}

export interface FighterStyle {
  currentTendency: StyleTendency
  tendencyStrength: number    // 0-100. Low = undefined. High = clearly one thing.
  southpaw: boolean
}

export interface AmateurTitle {
  circuitLevel: string
  weightClassId: string
  wonYear: number
  wonWeek: number
  eventId: string
}

export interface Medal {
  type: 'gold' | 'silver' | 'bronze'
  circuitLevel: string
  eventId: string
  year: number
}

export interface AmateurRanking {
  sanctioningBodyId: string
  weightClassId: string
  position: number
  points: number
}

export interface ProTitle {
  beltId: string              // references pro-title-belts.json
  sanctioningBodyId: string
  weightClassId: string
  wonYear: number
  wonWeek: number
  defences: number
  active: boolean
  vacatedYear?: number
  vacatedWeek?: number
}

export interface ProRanking {
  sanctioningBodyId: string   // wbc, wba, ibf, wbo
  weightClassId: string
  position: number            // 1-15
  points: number
}

export interface Clause {
  type: string                // references pro-fight-offer.json clauseTypes
  details: Record<string, unknown>
  expiresYear?: number
  expiresWeek?: number
}

export interface AmateurCareer {
  wins: number
  losses: number
  boutIds: string[]
  titles: AmateurTitle[]
  medals: Medal[]
  rankings: AmateurRanking[]
  registeredWithBodyId: string | null
}

export interface ProCareer {
  wins: number
  losses: number
  draws: number
  knockouts: number           // KO/TKO wins only
  boutIds: string[]
  titles: ProTitle[]
  rankings: ProRanking[]
  promoterId: string | null
  contractStartYear: number | null
  contractStartWeek: number | null
  contractEndYear: number | null
  contractEndWeek: number | null
  activeClauses: Clause[]
  managerId: string | null
}

export interface FighterAmbitions {
  level: AmbitionLevel
  goalCircuitLevel: string | null
  timeframe: 'patient' | 'urgent'
  proBeltTarget: string | null   // specific belt id, e.g. 'wbc_world_lightweight'
}

export interface FighterCareerState {
  currentGymId: string | null
  gymJoinedYear: number | null
  gymJoinedWeek: number | null
  coachId: string | null
  ambitions: FighterAmbitions
  stagnationState: StagnationState
  loyaltyScore: number          // 0-100, relationship with current gym
  coachabilityScore: number     // 0-100, derived from soul traits + coach relationship
  readiness: number             // 0-100, engine assessment — never shown as number to player
  lastBoutYear: number | null
  lastBoutWeek: number | null
}

export interface PlayerKnowledge {
  // Respects the ocean rule — what the player actually knows about this fighter.
  depthLevel: number            // 0-5, how well player knows this person
  revealedSoulTraits: string[]
  revealedPhysicalGifts: string[]
  revealedFlaws: string[]
  firstMetYear: number | null
  firstMetWeek: number | null
  lastInteractionYear: number | null
  lastInteractionWeek: number | null
  notes: string[]               // player's own observations, added via UI
}

// ─── Fighter ─────────────────────────────────────────────────────────────────

export interface Fighter extends Person {
  // Layer 1 — Fighter Identity
  fighterIdentity: FighterIdentity

  // Layer 2 — Boxing Background (set at generation, never changes)
  boxingBackground: BoxingBackground

  // Layer 3 — Developed Attributes (grow through training and fighting)
  developedAttributes: DevelopedAttribute[]

  // Layer 4 — Attribute History (engine analysis and dev mode)
  attributeHistory: AttributeHistory[]

  // Layer 5 — Style (emerges, not assigned)
  style: FighterStyle

  // Layer 6 — Competition Record
  competition: {
    status: CompetitionStatus
    weightClassId: string
    amateur: AmateurCareer
    pro: ProCareer
  }

  // Layer 7 — Career State
  career: FighterCareerState

  // Layer 8 — Player Knowledge (ocean rule)
  playerKnowledge: PlayerKnowledge
}
```

Export `Fighter` and all sub-interfaces from `src/types/index.ts`.

---

## Part 2 — Fighter Generation

**`packages/engine/src/generation/fighter.ts`**

```typescript
// generateFighter creates a complete Fighter from a generated Person.
// A Person becomes a Fighter when the world generation assigns them
// to a gym and determines they have boxing background.
// Not every Person is a Fighter — only those with some boxing history
// or those the world generation identifies as potential competitors.
//
// Generation order:
// 1. Assign boxing background (years training, prior gym, self taught)
// 2. Assign fighter identity state based on background, age, soul traits
// 3. Assign weight class from physical build
// 4. Calculate starting developed attributes from background + soul traits + nation
// 5. Assign starting style tendency from soul traits + physical build
// 6. Assign ambitions from soul traits + reason for boxing
// 7. Assign career state (gym, coach, loyalty, readiness)
// 8. Initialise competition record (empty for new fighters, populated for statistically generated ones)
// 9. Initialise player knowledge (depth 0, nothing revealed)

export function generateFighter(
  person: Person,
  gymId: string | null,
  coachId: string | null,
  data: GameData,
  rng: RNG,
  options?: FighterGenerationOptions
): Fighter

export interface FighterGenerationOptions {
  // For statistically generated fighters (world pre-generation)
  // who already have career history.
  existingRecord?: {
    amateurWins: number
    amateurLosses: number
    proWins: number
    proLosses: number
    titlesHeld: string[]   // belt ids
  }
  forceIdentityState?: FighterIdentityState
  forceWeightClass?: string
}
```

### Generation Rules

**Boxing background:**
- `yearsTraining` — derived from age and soul traits. A hungry 25 year old likely started earlier than a content 25 year old. Range: `max(0, age - firstTrainedAge)`.
- `firstTrainedAge` — rolled based on nation boxing culture rating and soul traits. High boxing culture nation + hungry trait → earlier start (12-15). Low culture + content → later start (16-22).
- `selfTaught` — probability based on nation boxing culture. Culture 1-2 → 40% self taught. Culture 5 → 5% self taught.
- `priorGymId` — if yearsTraining > 2 and not self taught, may have prior gym. Assign from same city population of gyms.

**Fighter identity state:**
Derive from soul traits, background, and age:
- `hungry` + `prove_something` reason → high probability of `aspiring` or `competing`
- `content` + `outlet` reason → high probability of `unaware` or `curious`
- Age > 30 + no bouts → likely `unaware` or quietly `curious`
- If `existingRecord` provided with bouts → `competing`

**Weight class:**
Assign from `weightKg` on Person's physical profile. Find the lightest weight class whose `limitKg` is above the fighter's weight. Heavyweight if above all limits.

**Starting developed attributes:**
Use `startingValueFormula` from `attribute-accumulation.json`:
- Base value from `baseByYearsTraining` lookup
- Apply `selfTaught` or `priorGym` modifier
- Apply nation cultural modifiers from `nation.json`
- Apply soul trait modifiers — trusting/paranoid affects all technical starts; humble/arrogant affects technique start
- Apply mental attribute cap from `mentalAttributeStartingCap` based on bout history
- If `existingRecord` provided — use bout count to raise mental attribute caps appropriately

**Style tendency:**
Derive from soul traits and physical build:
- `brave` + high `power` → pressure lean
- `patient` + good `footwork` → boxer lean
- `hungry` + high `combination_fluency` starting → boxer_puncher lean
- `reckless` + high `power` → brawler lean
- `patient` + high `counter_punching` → counterpuncher lean
- Raw fighters (< 2 years training) → `undefined` regardless of traits
- `tendencyStrength` starts low (10-30) — grows through training and fights

**Ambitions:**
Derive from soul traits and reason for boxing:
- `way_out` reason + `hungry` → `world_title` or `undisputed`
- `prove_something` reason + `brave` → `national` or `international`
- `passion` reason → `national` or `olympic` depending on traits
- `outlet` reason + `content` → `local` or `undecided`
- `fell_into_it` → `undecided`
- `timeframe` — `hungry` or `impatient` trait → `urgent`. `patient` or `content` → `patient`.

**Coachability score:**
Initial value derived from soul traits only (coach relationship not yet established):
- `trusting` → 70-85 base
- `paranoid` → 30-50 base
- `humble` → +10 modifier
- `arrogant` → -15 modifier
- Neither trusting/paranoid → 50-65 base

**Readiness:**
Initial readiness based on identity state and background:
- `competing` with recent bouts → 60-80
- `aspiring` with training background → 40-60
- `curious` or `unaware` → 10-30

---

## Part 3 — Tests

**`packages/engine/src/generation/fighter.test.ts`**

Tests:
- Generated fighter has all required fields from Fighter interface
- Weight class assigned correctly from physical weight
- Mental attributes capped correctly for fighter with no bouts
- Mental attributes higher for fighter with existing record of 20 bouts
- Hungry + way_out reason → ambition level is world_title or undisputed
- Content + outlet reason → ambition level is local or undecided
- Style tendency is undefined for fighter with < 2 years training
- Brave + high power → pressure or boxer_puncher tendency (not undefined after 5+ years)
- Coachability higher for trusting fighter than paranoid fighter
- Same seed → same fighter (determinism)
- Fighter with existingRecord has competing identity state
- Prior gym modifier applied to technical starting attributes

---

## Part 4 — Update Engine Index

**`packages/engine/src/index.ts`**

Export `Fighter` type and `generateFighter` function from the public API.

---

### Definition Of Done
- [ ] `src/types/fighter.ts` — complete, all sub-interfaces, extends Person
- [ ] All sub-interfaces exported from `src/types/index.ts`
- [ ] `src/generation/fighter.ts` — generates valid fighters, all generation rules implemented
- [ ] `src/generation/fighter.test.ts` — all listed tests passing
- [ ] `src/index.ts` updated — Fighter type and generateFighter exported
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing — all existing tests still pass
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — fighter.ts marked `[x]`
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: fighter type + fighter generation`

### Notes
- Read engine skill fully before writing any code
- Fighter extends Person — never duplicate Person fields
- generateFighter takes a Person and adds the Fighter layers — it does not call generatePerson internally
- For statistically generated fighters, existingRecord drives mental attribute starting values and identity state
- All randomness through RNG — no Math.random()
- Comment why on every non-obvious generation decision
- attributeHistory starts empty for new fighters — events are added as the simulation runs
- playerKnowledge starts at depthLevel 0, all arrays empty — the player knows nothing about a fighter until they interact
