# Current Task

## Task: Fighter Lifecycle + World Generation Rework

### What To Build
A complete rework of world generation to produce a living ecosystem with proper age distribution, career histories for veterans, annual replacement pipeline, and retirement tracking. Combined with the soul trait fix, person model removal, equipment maintenance, and gym finance calibration.

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## Part 1 — Soul Traits: Exactly 3, No Contradictions

**Location:** `packages/engine/src/generation/person.ts`

A person has exactly 3 soul traits. Picked from 3 randomly chosen pairs. Cannot have both sides of any pair.

```typescript
// 1. Take all 8 trait pairs from soul-traits.json
// 2. Shuffle pairs using seeded RNG
// 3. Pick first 3 pairs
// 4. From each chosen pair, pick one side:
//    - Roll against pair.sideAWeight (probability side A is chosen)
//    - Some pairs favour one side — brave more common than craven etc
// 5. Result: exactly 3 traits, guaranteed no contradictions

const shuffledPairs = rng.shuffle([...data.soulTraits.traits])
const chosenPairs = shuffledPairs.slice(0, 3)
const traits = chosenPairs.map(pair =>
  rng.next() < pair.sideAWeight
    ? { traitId: pair.sideA.id, revealed: false }
    : { traitId: pair.sideB.id, revealed: false }
)
```

Add `sideAWeight` to soul-traits.json per pair — probability (0.0-1.0) that side A is picked. Reflects real world distribution — brave more common than craven, humble more common than arrogant etc:

```json
{ "id": "brave_craven",    "sideA": "brave",      "sideB": "craven",      "sideAWeight": 0.65 },
{ "id": "humble_arrogant", "sideA": "humble",     "sideB": "arrogant",    "sideAWeight": 0.60 },
{ "id": "patient_impatient","sideA": "patient",   "sideB": "impatient",   "sideAWeight": 0.50 },
{ "id": "trusting_paranoid","sideA": "trusting",  "sideB": "paranoid",    "sideAWeight": 0.60 },
{ "id": "disciplined_reckless","sideA":"disciplined","sideB":"reckless",   "sideAWeight": 0.55 },
{ "id": "determined_fragile","sideA":"determined", "sideB":"fragile",     "sideAWeight": 0.65 },
{ "id": "hungry_content",  "sideA": "hungry",     "sideB": "content",     "sideAWeight": 0.55 },
{ "id": "proud_humble2",   "sideA": "proud",      "sideB": "shameful",    "sideAWeight": 0.70 }
```

Note: verify actual pair ids match soul-traits.json exactly.

Update all soul trait checks in engine to use safe lookup:
```typescript
const hasTrait = (traitId: string) =>
  entity.soulTraits.some(t => t.traitId === traitId)
```

Verify this pattern is used consistently in: `fighter.ts`, `coach.ts`, `roundResolution.ts`, `attributeEvents.ts`, `identityTick.ts`, `coachEntryDecision.ts`.

---

## Part 2 — Remove Person as Standalone Entity

**The new model:** Every entity is either a Fighter, a Coach, or doesn't exist. Gyms carry `casualMemberCount` as a number for revenue and culture.

### Update `packages/engine/src/types/gym.ts`

Add field (may already exist — verify):
```typescript
casualMemberCount: number
// Non-competing members who train for fitness and pay dues.
// Not tracked individually — drives revenue and culture calculations.
// Roughly 70% of gym capacity at generation, varies by gym tier.
```

### Update `packages/engine/src/generation/world.ts`

Remove all Person pool generation. Replace with direct Fighter and Coach generation:

```typescript
// For each gym in each city:
// 1. Calculate fighter count: floor(gym.lockerCount × city.talentDensity × 0.30)
// 2. Calculate casual count: floor(gym.lockerCount × 0.70)
// 3. Generate fighters with age distribution (see Part 3)
// 4. Generate coaches from retired fighters in the gym (see Part 5)
// 5. Set gym.casualMemberCount = casual count
// 6. Set gym.fighterIds = generated fighter ids
// 7. Set gym.memberIds = [] — no longer used, keep field for compatibility
```

### Remove from IPC/SQLite

Do not write to `persons` table during world generation. The table can remain for future use but world gen writes fighters and coaches only.

---

## Part 3 — Age Distribution at Generation (2016)

When generating fighters for a gym, use this age pyramid:

```typescript
const AGE_COHORTS = [
  { minAge: 13, maxAge: 17, fraction: 0.15 },
  { minAge: 18, maxAge: 22, fraction: 0.25 },
  { minAge: 23, maxAge: 28, fraction: 0.30 },
  { minAge: 29, maxAge: 34, fraction: 0.20 },
  { minAge: 35, maxAge: 40, fraction: 0.10 },
]
```

For N fighters to generate:
- Roll age from cohort range using the fraction as weight
- Pass age to `generateFighter` — it affects starting attributes, identity state, and whether a career history is needed

**Identity state biases by cohort:**
- 13-17: force `unaware` or `curious` (80/20 split)
- 18-22: weighted toward `curious` or `aspiring` (30/70)
- 23-28: weighted toward `aspiring` or `competing` (20/80)
- 29-34: weighted toward `competing` (90%) or `retired` (10%)
- 35-40: weighted toward `competing` (40%) or `retired` (60%)

---

## Part 4 — Statistical Career Generation for Veterans

Fighters aged 29+ at world generation start (2016) need plausible career histories. Generated in one pass — not simulated.

**`packages/engine/src/generation/veteranCareer.ts`**

```typescript
// generateVeteranCareer produces a plausible career record for a fighter
// who has been competing before world generation starts.
// Not simulated — statistically generated based on attributes and years active.
// Called from generateFighter when age > 28 and identityState is competing or retired.

export function generateVeteranCareer(
  fighter: Fighter,
  yearsActive: number,   // age - firstCompetedAge (estimated ~18-20)
  data: GameData,
  rng: RNG
): VeteranCareerRecord

export interface VeteranCareerRecord {
  amateurWins: number
  amateurLosses: number
  peakCircuitLevel: string
  titlesHeld: string[]       // belt ids for national titles if earned
  medals: Medal[]
}
```

**Generation rules:**

```typescript
// Bouts per year: 3-8 depending on competition status and age
// Older fighters fight less frequently
const boutsPerYear = rng.nextInt(3, 8)
const totalBouts = Math.round(yearsActive * boutsPerYear * rng.nextFloat(0.7, 1.0))

// Win rate based on overall attribute quality
// High attribute fighter: 60-75% win rate
// Average: 45-60%
// Low: 30-50%
const attributeScore = calculateOverallAttributeScore(fighter)
const winRate = mapAttributeScoreToWinRate(attributeScore, rng)

const wins = Math.round(totalBouts * winRate)
const losses = totalBouts - wins

// Peak circuit level based on win rate and total bouts
// Many wins vs quality opponents → reached national level
// Moderate record → regional level
// Weak record → club card level
const peakCircuit = derivePeakCircuit(wins, losses, attributeScore, rng)

// Titles: only if reached national_championship and win rate > 0.60
const titlesHeld = []
if (peakCircuit === 'national_championship' && winRate > 0.60 && rng.next() < 0.3) {
  // Assign national title for their weight class
  titlesHeld.push(`lbf_national_${fighter.competition.weightClassId}`)
}
```

Apply the veteran career to the fighter record after generation. Update `developedAttributes` to reflect career history — a fighter with 50 amateur bouts has higher mental attributes than one who just started. Use the mental attribute caps from `attribute-accumulation.json` keyed on bout count.

---

## Part 5 — Coaches from Retired Fighters

After generating all fighters for a gym, identify coaches:

```typescript
// Head coach selection:
// Look for fighters in 'retired' identity state with age > 28
// Pick the one with highest overall attribute score
// If none retired: pick oldest 'competing' fighter age > 32 (still fighting but also coaching)
// If neither: gym has no head coach (isGymMemberFilling: true with null personId)

// Generate their Coach record using generateCoach() with formerFighter: true
// careerPeakPrestige derived from their veteranCareer.peakCircuitLevel
// yearsCoaching = max(0, currentAge - 32) — rough estimate of when they started coaching
```

---

## Part 6 — Annual New Fighter Pipeline (Backrun)

**Location:** `packages/engine/src/engine/advanceWeek.ts` or new `annualTick.ts`

At week 52 of each simulated year, seed new young fighters into each city:

```typescript
// Annual pipeline seeding
function runAnnualPipeline(state: AdvanceWeekState, data: GameData, rng: RNG): void {
  for (const [nationId, nation] of state.worldState.nations) {
    for (const city of nation.cities) {
      // Base annual seed by city size
      const baseSeed = city.population === 'large_city' ? 8
                     : city.population === 'mid_city'   ? 4
                     : 2  // small_town

      // Adjust for talent density and retirements this year
      const retiredThisYear = state.annualRetirementCount[city.id] ?? 0
      const newCount = Math.max(
        Math.round(baseSeed * city.talentDensity * rng.nextFloat(0.8, 1.2)),
        Math.round(retiredThisYear * 0.8)  // replace 80% of retirements
      )

      // Generate new fighters aged 13-16
      for (let i = 0; i < newCount; i++) {
        const age = rng.nextInt(13, 16)
        const gym = findGymWithCapacity(state, city.id, rng)
        if (!gym) continue
        const fighter = generateFighter(
          createBasePerson(age, nationId, city.id, data, rng),
          gym.id, null, data, rng,
          { forceIdentityState: 'unaware' }
        )
        addFighterToWorld(state, fighter, gym)
      }
    }
  }
  // Reset annual retirement counter
  state.annualRetirementCount = {}
}
```

**Track retirements:** In `identityTick.ts`, when a fighter transitions to `retired`, increment `state.annualRetirementCount[fighter.cityId]`.

Add `annualRetirementCount: Record<string, number>` to `AdvanceWeekState`.

---

## Part 7 — Equipment Auto-Maintenance

**Location:** `packages/engine/src/engine/weeklyTick.ts`

After equipment decay each week:

```typescript
for (const item of gym.equipment) {
  if (item.condition < 25 && item.inUse) {
    const equipType = data.gymEquipmentTypes.equipment.find(e => e.id === item.typeId)
    if (!equipType) continue
    const repairCost = equipType.purchaseCost * 0.15
    if (gym.finances.balance >= repairCost) {
      item.condition = Math.min(75, item.condition + 50)
      item.lastMaintenanceYear = state.year
      item.lastMaintenanceWeek = state.week
      gym.finances.balance -= repairCost
    }
    // Cannot afford: equipment stays degraded
    // Struggling gyms produce worse training — intentional
  }
}

// Monthly maintenance cost (every 4 weeks)
if (state.week % 4 === 0) {
  const monthlyCost = gym.equipment
    .filter(e => e.inUse && e.condition > 0)
    .reduce((sum, item) => {
      const type = data.gymEquipmentTypes.equipment.find(t => t.id === item.typeId)
      return sum + (type?.maintenanceCostMonthly ?? 0)
    }, 0)
  gym.finances.balance -= monthlyCost
}
```

---

## Part 8 — Gym Finances Using casualMemberCount

**Location:** `packages/engine/src/engine/weeklyTick.ts`

```typescript
// Weekly income
const totalMembers = gym.casualMemberCount + gym.fighterIds.length
const weeklyIncome = (totalMembers * gym.finances.membershipFeeMonthly) / 4

// Weekly outgoings
const weeklyRent = gym.finances.monthlyRent / 4
const weeklyWages = gym.staffMembers
  .reduce((sum, s) => sum + s.wageMonthly / 4, 0)
const weeklyOutgoings = weeklyRent + weeklyWages

gym.finances.balance += (weeklyIncome - weeklyOutgoings)
```

**Calibrate `casualMemberCount` at gym generation:**

```typescript
// In generateGym():
const casualMultiplier = {
  rundown_community: 0.60,
  established_community: 0.55,
  competition_gym: 0.40,
  elite_gym: 0.25,
}
gym.casualMemberCount = Math.round(
  gym.lockerCount * casualMultiplier[templateId] * rng.nextFloat(0.8, 1.2)
)
```

---

## Verification — Expected CLI Output

Run CLI after all fixes. Target ranges:

```
latvia
├─ Fighters: 150-220
│    competing: 50-80  aspiring: 50-70  retired: 20-40  unaware: 20-40
└─ Bouts resolved: 1,500-2,500

BOUT RESULTS
KO/TKO: 25-40%
Decision: 60-75%

ATTRIBUTES (latvia competing fighters only)
power    mean: 7-11
ring_iq  mean: 4-8
heart    mean: 3-6

GYM FINANCIALS
Gyms in deficit: 15-30%
Most profitable: €15,000-€80,000

TOP FIGHTERS
Record range: 15-40 bouts total for top fighters
Age range: 26-36 for top competitors
```

Include full CLI output in the commit message.

---

### Definition Of Done
- [ ] Soul traits: every fighter has exactly 3, no contradictions, sideAWeight in soul-traits.json
- [ ] No Person records generated — fighters and coaches only
- [ ] `casualMemberCount` on gym, calibrated per template
- [ ] Age distribution pyramid — 5 cohorts at world generation
- [ ] `generateVeteranCareer` — plausible records for fighters aged 29+
- [ ] Veteran attributes reflect career history (mental attribute caps applied)
- [ ] Annual new fighter pipeline — seeds young fighters each year
- [ ] `annualRetirementCount` tracked, drives replacement rate
- [ ] Equipment auto-maintenance — gyms repair when affordable
- [ ] Gym finances use `casualMemberCount` — no person record dependency
- [ ] CLI output within expected ranges above
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed with full CLI output in commit message: `fix: fighter lifecycle + world generation rework`

### Notes
- Read engine skill fully before touching any code
- Fix soul traits first — affects every downstream generation step
- veteranCareer is statistical generation not simulation — one pass, no loops
- Annual pipeline uses annualRetirementCount to calibrate replacement — track retirements in identityTick
- Equipment maintenance is intentionally limited by finances — struggling gyms degrade, that's correct
- After all fixes, rebuild, generate new save, run CLI, verify numbers before committing
