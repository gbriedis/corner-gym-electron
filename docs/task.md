# Current Task

## Task: Coach System — Full Type + Generation + Relationships

### What To Build
Full Coach type replacing the stub, CoachFighterRelationship on Fighter, coach generation function, update gym generation to assign real coaches, and the Latvia coach generation parameters data file.

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## Part 1 — Data File

### `packages/engine/data/nations/latvia/coach-generation.json`

```json
{
  "meta": {
    "version": "1.0.0",
    "description": "Coach generation parameters for Latvia. Defines specialist coach probability, quality ranges by experience tier, and growth rates. The engine reads this when generating coaches during world creation. Most coaches at grassroots level are former fighters — specialists are rarer and more expensive but have a higher quality ceiling in specific areas."
  },
  "specialistCoachProbability": 0.15,
  "specialistQualityByExperience": {
    "new":        { "qualityRange": [5, 9],   "potentialBonus": [2, 4] },
    "experienced":{ "qualityRange": [9, 14],  "potentialBonus": [1, 3] },
    "veteran":    { "qualityRange": [12, 16], "potentialBonus": [1, 2] }
  },
  "formerFighterCoachProbability": 0.85,
  "qualityGrowthPerYear": 0.5,
  "styleCertaintyGrowthPerYear": 4.0,
  "maximumStyleCertaintyGymMember": 80,
  "maximumStyleCertaintyHiredCoach": 95
}
```

---

## Part 2 — Full Coach Type

**Replace stub in `packages/engine/src/types/coach.ts`**

```typescript
// Coach — a Person who develops fighters.
// Every coach was either a former fighter who transitioned into coaching,
// or a specialist who never competed but built expertise through study and experience.
//
// A coach's style is NOT their fighting style — it is how they teach.
// A former pressure fighter may become a technical coach if their soul traits
// drive them to study what they lacked as a fighter. The connection between
// fighting background and coaching emphasis is a starting tendency, not a rule.
//
// Quality grows toward qualityPotential over years of coaching experience.
// styleCertainty grows as the coach develops a clear identity over time.

import type { CoachStyle } from './coach.js'
export type { CoachStyle }

export interface CoachFighterRelationship {
  fighterId: string
  trustScore: number            // 0-100. Starts from trait compatibility. Grows with time and results.
  weeksWorkedTogether: number
  lastConflictYear: number | null
  lastConflictWeek: number | null
  note: string | null           // player-added observations — same ocean rule as fighter knowledge
}

export interface Coach {
  id: string
  personId: string              // references the Person this coach is
  gymId: string
  role: 'head_coach' | 'secondary_coach' | 'fitness_coach' | 'kids_coach'

  // Quality — how effective they are at developing fighters
  quality: number               // 1-20. Current coaching quality.
  qualityPotential: number      // 1-20. The ceiling quality can reach. Former elite fighters have higher ceiling.
  weeksCoaching: number         // total coaching experience — quality grows toward potential as this increases

  // Style — how they teach (NOT their former fighting style)
  style: CoachStyle             // emphasis, methodology, communicationStyle
  styleCertainty: number        // 0-100. How defined their coaching identity is. Low = still finding their way.

  // Background
  formerFighter: boolean
  careerPeakCircuitLevel: string | null   // null for specialists
  careerPeakPrestige: number              // 0-7, from circuit level prestige

  // Relationships — stored on coach, cross-referenced from Fighter
  fighterRelationships: CoachFighterRelationship[]
}
```

Export `Coach`, `CoachFighterRelationship`, `CoachStyle` from `src/types/index.ts`.

---

## Part 3 — Update Fighter Type

**Update `packages/engine/src/types/fighter.ts`**

Add `coachingHistory` to `FighterCareerState`:

```typescript
export interface FighterCareerState {
  // ... existing fields ...
  coachingHistory: PastCoachRecord[]
}

export interface PastCoachRecord {
  // History of past coaching relationships — travels with the fighter.
  // New gym starts fresh but past coaches shaped who this fighter became.
  coachId: string
  gymId: string
  startYear: number
  startWeek: number
  endYear: number | null      // null if still active
  endWeek: number | null
  peakTrustScore: number      // highest trust reached in this relationship
  weeksWorkedTogether: number
}
```

---

## Part 4 — TypeScript Type For Data File

**Update `packages/engine/src/types/data/gym.ts`**

Add:
```typescript
export interface CoachGenerationData {
  meta: Meta
  specialistCoachProbability: number
  specialistQualityByExperience: {
    new: { qualityRange: [number, number]; potentialBonus: [number, number] }
    experienced: { qualityRange: [number, number]; potentialBonus: [number, number] }
    veteran: { qualityRange: [number, number]; potentialBonus: [number, number] }
  }
  formerFighterCoachProbability: number
  qualityGrowthPerYear: number
  styleCertaintyGrowthPerYear: number
  maximumStyleCertaintyGymMember: number
  maximumStyleCertaintyHiredCoach: number
}
```

Add to `src/types/data/index.ts`.

---

## Part 5 — Update Loader

Add to `NationBundle` in `src/data/loader.ts`:
```typescript
coachGeneration: CoachGenerationData
```

Load from `nations/latvia/coach-generation.json`.

---

## Part 6 — Coach Generation Function

**`packages/engine/src/generation/coach.ts`**

```typescript
// generateCoach creates a Coach from a Person.
// Two paths:
// 1. Former fighter — quality derived from career peak and soul traits
// 2. Specialist — quality assigned directly from experience tier
//
// Coaching style starts influenced by fighting background but is shaped
// by soul traits — a humble former brawler may become a technical coach
// because they coach what they wish they had, not what they were.
//
// Quality grows toward qualityPotential at 0.5 per year of coaching.
// styleCertainty grows 4 points per year up to the maximum for their role.

export interface CoachGenerationOptions {
  formerFighter: boolean
  careerPeakCircuitLevel?: string    // required if formerFighter = true
  careerPeakPrestige?: number        // required if formerFighter = true
  fightingStyleTendency?: string     // the style they used as a fighter
  specialistExperience?: 'new' | 'experienced' | 'veteran'  // required if formerFighter = false
  isGymMemberFilling?: boolean       // affects styleCertainty maximum
  yearsCoaching?: number             // how long they have been coaching at world generation
  role?: 'head_coach' | 'secondary_coach' | 'fitness_coach' | 'kids_coach'
}

export function generateCoach(
  person: Person,
  gymId: string,
  data: GameData,
  rng: RNG,
  options: CoachGenerationOptions
): Coach
```

### Generation Rules

**Quality for former fighters:**
```
baseQuality = (careerPeakPrestige / 7) × 10   // 1-10 from career peak
traitBonus:
  humble      → +2
  patient     → +2
  trusting    → +1
  disciplined → +1
traitPenalty:
  arrogant    → -2
  reckless    → -2
  paranoid    → -1
startingQuality = clamp(1, 18, base + bonuses + penalties)
qualityPotential = clamp(startingQuality, 20, startingQuality + rng.nextInt(1, 3))
```

Comment: former fighters start with quality reflecting career knowledge. Soul traits determine how well they translate that knowledge into teaching. A national champion who is arrogant and reckless is a worse coach than a regional finalist who is humble and patient.

**Quality for specialists:**
```
Roll qualityRange from specialistQualityByExperience[experience tier]
qualityPotential = quality + roll potentialBonus range
```

**Quality adjustment for years coaching:**
```
// If yearsCoaching > 0, advance quality toward potential
yearsToAdvance = options.yearsCoaching ?? 0
qualityGrowth = yearsToAdvance × data.nations[nationId].coachGeneration.qualityGrowthPerYear
quality = clamp(1, qualityPotential, quality + qualityGrowth)
```

**Coaching style — emphasis:**

For former fighters, derive starting emphasis from fighting style:
```
'pressure' | 'swarmer'        → 'pressure'
'boxer' | 'counterpuncher'    → 'technical'
'boxer_puncher'               → 'balanced'
'brawler'                     → 'physical'
'undefined'                   → 'balanced'
```

Then apply soul trait drift:
- `humble` AND `patient` → shift toward `technical` regardless of fighting background
  - Comment: humble, patient coaches study what fighters need, not what they personally did
- `reckless` → shift toward `physical` or keep `freestyle` methodology
- `disciplined` → reinforce whatever emphasis toward more structured methodology

For specialists: roll emphasis randomly weighted: technical 35%, balanced 30%, pressure 15%, physical 15%, defensive 5%

**Coaching style — methodology:**
```
disciplined soul trait → 'disciplined'
reckless soul trait    → 'freestyle'
neither                → 'structured'
```

**Coaching style — communicationStyle:**
```
(brave OR determined) AND NOT fragile → 'demanding'
(humble OR patient) AND NOT arrogant  → 'supportive'
paranoid OR content                   → 'detached'
default                               → 'supportive'
```

**styleCertainty:**
```
base = rng.nextInt(15, 35)
yearsBoost = (options.yearsCoaching ?? 0) × coachGeneration.styleCertaintyGrowthPerYear
maximum = options.isGymMemberFilling
  ? coachGeneration.maximumStyleCertaintyGymMember
  : coachGeneration.maximumStyleCertaintyHiredCoach
styleCertainty = clamp(0, maximum, base + yearsBoost)
```

**Initial fighter relationships:** empty array — relationships form as coaching happens.

---

## Part 7 — Update generateGym

**Update `packages/engine/src/generation/gym.ts`**

Replace the simple head coach assignment with a proper coach generation call.

In the staff assignment step:

```typescript
// Find the best candidate for head coach from the gym's fighter population.
// Candidate must be: age > 28, NOT in 'competing' identity state.
// Quality is derived from their career — fighters who went further make better coaches.
// If no eligible fighter exists — gym has no head coach at world start.

const coachCandidate = findBestCoachCandidate(fighters, gym)
if (coachCandidate !== null) {
  const coach = generateCoach(
    coachCandidate.person,
    gym.id,
    data,
    rng,
    {
      formerFighter: true,
      careerPeakCircuitLevel: coachCandidate.fighter.competition.amateur.titles[0]?.circuitLevel ?? 'club_card',
      careerPeakPrestige: derivePrestige(coachCandidate.fighter),
      fightingStyleTendency: coachCandidate.fighter.style.currentTendency,
      isGymMemberFilling: true,
      yearsCoaching: Math.max(0, coachCandidate.person.age - 30),
      role: 'head_coach'
    }
  )
  // Add to gym staff, update gym culture coachingFocus from coach style emphasis
  gym.staffMembers.push({
    personId: coachCandidate.person.id,
    role: 'head_coach',
    startedYear: 0,
    startedWeek: 0,
    wageMonthly: 0,
    isGymMemberFilling: true
  })
  // Store coach separately — returned from generateGym
}
```

Update `generateGym` return type to include coaches:
```typescript
export function generateGym(...): { gym: Gym; coaches: Coach[] }
```

Update `generateWorld` to collect coaches from all gym generations and return them.

Update `generateWorld` return type:
```typescript
export function generateWorld(...): {
  worldState: WorldState
  persons: Person[]
  fighters: Fighter[]
  gyms: Gym[]
  coaches: Coach[]
  calendar: CalendarEvent[]
}
```

---

## Part 8 — SQLite

**Update `packages/desktop/src/db.ts`**

Add coaches table:
```sql
CREATE TABLE IF NOT EXISTS coaches (
  id TEXT NOT NULL,
  saveId TEXT NOT NULL,
  data TEXT NOT NULL,     -- JSON serialised Coach
  gymId TEXT NOT NULL,
  personId TEXT NOT NULL,
  quality INTEGER NOT NULL,
  PRIMARY KEY (id, saveId),
  FOREIGN KEY (saveId) REFERENCES saves(id) ON DELETE CASCADE
);
```

Export typed functions:
```typescript
export function saveCoaches(db: Database, saveId: string, coaches: Coach[]): void
export function loadCoaches(db: Database, saveId: string): Coach[]
export function getCoachesByGym(db: Database, saveId: string, gymId: string): Coach[]
```

Update `generate-and-save` IPC handler to save coaches.

---

## Part 9 — Tests

**`packages/engine/src/generation/coach.test.ts`**

Tests:
- Former fighter with national championship career has quality > 8
- Former fighter with humble + patient traits has higher quality than same career arrogant fighter
- Former brawler with humble trait gets technical emphasis (trait overrides fighting background)
- Former boxer gets technical emphasis by default
- Specialist coach quality within declared range
- Quality grows toward potential when yearsCoaching > 0
- Quality never exceeds qualityPotential
- styleCertainty capped at maximumStyleCertaintyGymMember for gym member filling role
- Same seed → same coach (determinism)
- Coach with demanding communication + supportive communication both valid outputs

---

### Definition Of Done
- [ ] `nations/latvia/coach-generation.json` — valid JSON, meta block
- [ ] `src/types/coach.ts` — full replacement, Coach + CoachFighterRelationship
- [ ] `src/types/fighter.ts` — PastCoachRecord + coachingHistory on FighterCareerState
- [ ] `src/types/data/gym.ts` — CoachGenerationData added
- [ ] Loader updated — coachGeneration on NationBundle
- [ ] `src/generation/coach.ts` — generateCoach with all rules
- [ ] `src/generation/coach.test.ts` — all listed tests passing
- [ ] `src/generation/gym.ts` — returns `{ gym, coaches }`, proper coach generation
- [ ] `src/generation/world.ts` — collects coaches, returns them in world output
- [ ] `db.ts` — coaches table, saveCoaches, loadCoaches, getCoachesByGym
- [ ] IPC handler saves coaches
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing — all 132 existing tests still pass
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: coach system — full type, generation, relationships`

### Notes
- Read engine skill fully before writing any code
- Coaching style ≠ fighting style — the connection is a starting tendency shaped by soul traits
- Former humble + patient coaches drift toward technical regardless of fighting background
- Quality grows toward potential with experience — never set quality above potential
- generateGym now returns { gym, coaches } — update all call sites in world.ts
- Comment why on every non-obvious quality or style derivation decision
