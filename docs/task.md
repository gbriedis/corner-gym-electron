# Current Task

## Task: USA Nation Bundle + Ethnicity System + Person Update

### What To Build
The complete USA nation data bundle, the ethnicity system, two new reasons for boxing, and updates to generatePerson to use ethnicity for name selection, trait weights, and physical profiles. After this session the world can generate American fighters with real cultural depth.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/rules/data.md`

---

## Part 1 — Update Universal Data

### Update `packages/engine/data/universal/reasons-for-boxing.json`

Add two new reasons:

```json
{
  "id": "family_tradition",
  "label": "Family Tradition",
  "description": "Boxing is in the blood. Father fought, uncle fought, older brother fought. This person didn't choose boxing — it chose them before they were old enough to decide. They carry a weight of expectation and pride into every fight.",
  "soulTraitAffinities": ["proud", "determined"],
  "soulTraitRisks": ["fragile"],
  "ambitionBias": "national_or_title",
  "note": "family_tradition fighters often struggle if they fail to live up to legacy. The same pride that drives them can break them."
},
{
  "id": "community_identity",
  "label": "Community Identity",
  "description": "You fight because your neighbourhood, your people, your community fights. You represent something beyond yourself every time you step in the ring. The whole block comes out to watch.",
  "soulTraitAffinities": ["brave", "proud", "hungry"],
  "ambitionBias": "competing_matters_as_much_as_winning",
  "note": "community_identity fighters get something extra from a crowd. The occasion lifts them."
}
```

Update `ReasonsForBoxingData` type in `src/types/data/reasonsForBoxing.ts` if needed.

---

## Part 2 — USA Nation Bundle

Create all files under `packages/engine/data/nations/usa/`.

### `nations/usa/nation.json`

```json
{
  "meta": {
    "version": "1.0.0",
    "description": "United States of America nation definition. Boxing culture 5 — the deepest pro infrastructure in the world. Pro ecosystem starts at level 4. Large fighter pool across ethnically diverse communities each with distinct boxing traditions. performanceHint gives the UI accurate estimates for new game configuration."
  },
  "id": "usa",
  "label": "United States",
  "demonym": "American",
  "language": "en",
  "currency": "USD",
  "boxingCulture": 5,
  "proEcosystemStartLevel": 4,
  "physicalStatsProfile": {
    "heightCmMale": { "mean": 178, "stdDev": 7 },
    "weightKgAtFlyweight": { "mean": 50, "stdDev": 2 },
    "reachCmBias": 1.02,
    "note": "US fighters skew slightly taller than global average with proportionally longer reach."
  },
  "performanceHint": {
    "estimatedFighters": 2400,
    "estimatedGyms": 180,
    "estimatedGenerationSeconds": 6
  }
}
```

---

### `nations/usa/cities.json`

20 cities exactly as designed. Each city entry:
- `id`, `label`, `state`, `population` (small_town/mid_city/large_city)
- `boxingCultureOverride` (3-5)
- `rentModifier`, `talentDensity`, `rivalGymDensity`
- `eventHostingFrequency` with club_card and regional_tournament min/max
- `description` — the flavour text capturing what makes this city distinctive

Cities in order:
1. `usa-las-vegas` — large_city, culture 5, rent 1.4, talent 1.3, rival 1.4
2. `usa-new-york` — large_city, culture 5, rent 1.8, talent 1.4, rival 1.5
3. `usa-brownsville-brooklyn` — small_town, culture 5, rent 1.6, talent 1.8, rival 0.8
4. `usa-los-angeles` — large_city, culture 5, rent 1.6, talent 1.3, rival 1.4
5. `usa-philadelphia` — large_city, culture 5, rent 1.1, talent 1.5, rival 1.3
6. `usa-chicago` — large_city, culture 4, rent 1.2, talent 1.2, rival 1.2
7. `usa-houston` — large_city, culture 4, rent 0.9, talent 1.2, rival 1.1
8. `usa-detroit` — mid_city, culture 5, rent 0.6, talent 1.4, rival 0.9
9. `usa-miami` — mid_city, culture 4, rent 1.3, talent 1.1, rival 1.0
10. `usa-oakland` — mid_city, culture 5, rent 1.4, talent 1.5, rival 0.9
11. `usa-san-antonio` — mid_city, culture 4, rent 0.7, talent 1.2, rival 0.9
12. `usa-new-orleans` — mid_city, culture 3, rent 0.7, talent 1.1, rival 0.7
13. `usa-oxnard` — small_town, culture 5, rent 1.1, talent 1.6, rival 0.7
14. `usa-stockton` — small_town, culture 4, rent 0.8, talent 1.4, rival 0.6
15. `usa-flint` — small_town, culture 4, rent 0.4, talent 1.5, rival 0.5
16. `usa-youngstown` — small_town, culture 4, rent 0.4, talent 1.4, rival 0.5
17. `usa-brockton` — small_town, culture 4, rent 0.9, talent 1.3, rival 0.6
18. `usa-albuquerque` — mid_city, culture 4, rent 0.6, talent 1.2, rival 0.7
19. `usa-cleveland` — mid_city, culture 3, rent 0.5, talent 1.1, rival 0.7
20. `usa-lowell` — small_town, culture 4, rent 0.8, talent 1.3, rival 0.5

Descriptions exactly as designed — use the flavour text from the design session. Brownsville Brooklyn description must mention Mike Tyson and "hardest start in the game." Detroit must mention Kronk.

---

### `nations/usa/ethnicities.json`

Full file as designed. Six ethnicities:
- `african_american`
- `mexican_american`
- `irish_american`
- `puerto_rican_american`
- `eastern_european_american`
- `white_american`

Each ethnicity has:
- `id`, `label`
- `cityWeights` — probability of this ethnicity in each city (only cities where they have meaningful presence)
- `soulTraitWeights` — multipliers on base soul trait probabilities
- `reasonForBoxingWeights` — multipliers on base reason probabilities
- `styleTendencyWeights` — multipliers on starting style tendency probabilities
- `physicalProfile` — real documented physical characteristics in boxing context:

```json
"physicalProfile": {
  "heightBias": 1.0,           // multiplier on mean height
  "reachBias": 1.0,            // multiplier on reach relative to height
  "weightBias": 1.0,           // multiplier on natural weight
  "handSpeedBias": 1.0,        // multiplier on hand_speed generation ceiling
  "powerBias": 1.0,            // multiplier on power generation ceiling
  "chinBias": 1.0,             // multiplier on chin generation ceiling
  "durabilityBias": 1.0,       // multiplier on durability generation ceiling
  "staminaBias": 1.0           // multiplier on stamina generation ceiling
}
```

Physical profiles per ethnicity — honest, documented, boxing-specific:

**african_american:**
```json
"physicalProfile": {
  "heightBias": 1.01,
  "reachBias": 1.04,
  "handSpeedBias": 1.08,
  "powerBias": 1.03,
  "chinBias": 0.97,
  "durabilityBias": 1.0,
  "staminaBias": 1.02
}
```
Comment: Documented longer reach relative to height, exceptional hand speed. Slight chin variance reflects real statistical distribution — not a penalty, a natural spread.

**mexican_american:**
```json
"physicalProfile": {
  "heightBias": 0.97,
  "reachBias": 0.98,
  "weightBias": 1.03,
  "handSpeedBias": 0.98,
  "powerBias": 1.06,
  "chinBias": 1.07,
  "durabilityBias": 1.08,
  "staminaBias": 1.03
}
```
Comment: Stockier build — shorter stature, broader frame, heavier for their height. Exceptional durability and chin — documented tradition of fighting through punishment. Superior power for their weight class.

**irish_american:**
```json
"physicalProfile": {
  "heightBias": 1.01,
  "reachBias": 1.0,
  "powerBias": 1.02,
  "chinBias": 1.04,
  "durabilityBias": 1.03,
  "staminaBias": 1.02
}
```
Comment: Solid builds with good chin. The heart and communication traits are where Irish-American fighters are most distinctive — reflected in soul trait weights not physical profile.

**puerto_rican_american:**
```json
"physicalProfile": {
  "heightBias": 0.99,
  "reachBias": 1.01,
  "handSpeedBias": 1.05,
  "powerBias": 1.04,
  "chinBias": 1.05,
  "durabilityBias": 1.05,
  "staminaBias": 1.02
}
```
Comment: Athletic build combining hand speed with durability. Similar tradition to Mexican-American fighters but slightly taller on average.

**eastern_european_american:**
```json
"physicalProfile": {
  "heightBias": 1.02,
  "reachBias": 1.01,
  "powerBias": 1.03,
  "chinBias": 1.05,
  "durabilityBias": 1.04,
  "staminaBias": 1.04
}
```
Comment: Strong amateur backgrounds produce solid technical builds. Good stamina from disciplined training traditions. Solid chin from Eastern European boxing culture.

**white_american:**
```json
"physicalProfile": {
  "heightBias": 1.0,
  "reachBias": 1.0,
  "powerBias": 1.0,
  "chinBias": 1.0,
  "durabilityBias": 1.0,
  "staminaBias": 1.0
}
```
Comment: Broad category with no consistent physical lean — baseline modifiers.

Meta must explain: physical profile biases reflect documented statistical distributions in professional boxing, not general population data. Boxing selects for certain physical attributes — these biases reflect who historically succeeds in the sport by ethnicity, not general population averages. All biases are modest multipliers on generation ceilings — no attribute is impossible for any ethnicity, distributions simply skew differently.

---

### `nations/usa/names.json`

Structured by ethnicity. Each entry has `male.firstNames` and `male.surnames` arrays with minimum 20 names each. Use names that reflect real naming patterns for each community in American boxing context — fighters' names, not generic name lists.

---

### `nations/usa/economic-statuses.json`

Same structure as Latvia. US-appropriate statuses:
- `welfare` — government assistance, food stamps
- `working_poor` — employed but struggling, paycheck to paycheck
- `working_class` — stable employment, modest means
- `lower_middle` — some financial cushion, homeowner possible
- `middle_class` — comfortable, college educated
- `upper_middle` — professional income, significant assets

Descriptions should feel American — reference real US economic context.

---

### `nations/usa/reasons-for-boxing.json`

Same structure as Latvia but weights adjusted for US boxing culture. Include all existing reasons plus the two new ones (`family_tradition`, `community_identity`). US-specific descriptions for each reason reflecting American boxing context.

---

### `nations/usa/gym-names.json`

American boxing gym naming patterns. Minimum 50 full names. Real patterns:
- Surname + Boxing (Kronk Boxing, Mayweather Boxing)
- City/neighbourhood + Boxing Club (Brownsville Boxing Club, Philly Boxing)
- Founder name + gym type (Garcia Boxing Academy)
- Sponsored names (Gold's Boxing, Title Boxing)
- Street address style (8th Street Gym — famous LA gym)
- Community programme names (Police Athletic League, PAL Boxing)

---

### `nations/usa/coach-generation.json`

Same structure as Latvia but higher quality ranges reflecting boxing culture 5 and deeper coaching tradition:

```json
{
  "specialistCoachProbability": 0.20,
  "specialistQualityByExperience": {
    "new":         { "qualityRange": [6, 10],  "potentialBonus": [2, 4] },
    "experienced": { "qualityRange": [10, 15], "potentialBonus": [1, 3] },
    "veteran":     { "qualityRange": [13, 17], "potentialBonus": [1, 2] }
  },
  "formerFighterCoachProbability": 0.80,
  "qualityGrowthPerYear": 0.5,
  "styleCertaintyGrowthPerYear": 4.0,
  "maximumStyleCertaintyGymMember": 80,
  "maximumStyleCertaintyHiredCoach": 95
}
```

---

### `nations/usa/boxing/`

Create all boxing data files following Latvia's structure:

**`sanctioning-bodies.json`** — USA Boxing (national amateur body), affiliated to AIBA/IBA. Same structure as LBF.

**`amateur-circuit.json`** — US amateur circuit levels:
- `club_card` — club show format
- `regional_tournament` — state/regional level tournament
- `national_championship` — USA Boxing National Championships (multi-day, November)
- `golden_gloves` — Golden Gloves tournament (historic, prestigious, same level as nationals)

**`lbf-rules.json` equivalent — `usab-rules.json`** — USA Boxing rules. Same structure as lbf-rules.json. Senior men: 3 rounds × 3 minutes. Youth: 3 × 2 minutes. Junior: 3 × 2 minutes. Headgear required below elite level. `maxBoutsPerDay`: nationals = 1, club = 2.

**`event-templates.json`** — US event templates for each circuit level.

**`venues.json`** — 12+ US venues. One per major boxing city minimum. Include:
- Small gym venues (club level) in Brownsville, Detroit, Philadelphia, Lowell
- Regional venues (mid level) in Chicago, Houston, San Antonio
- Major arenas (national level) in Las Vegas, New York, Los Angeles
- Include MGM Grand Garden Arena (las_vegas), Madison Square Garden (new_york), Staples Center (los_angeles), Kronk Gym (detroit — historic, smaller capacity)

**`pro-ecosystem.json`** — USA starts at level 4. Same structure as Latvia but `currentLevel: 4` and all thresholds already met.

**`promoters.json`** — US promoters voice lines for procedurally generated regional promoters. Tone: direct, business-focused, American. Different feel from Latvian dry understatement.

---

## Part 3 — Ethnicity TypeScript Types

**`packages/engine/src/types/data/ethnicities.ts`**

```typescript
export interface EthnicityPhysicalProfile {
  heightBias?: number
  reachBias?: number
  weightBias?: number
  handSpeedBias?: number
  powerBias?: number
  chinBias?: number
  durabilityBias?: number
  staminaBias?: number
}

export interface Ethnicity {
  id: string
  label: string
  cityWeights: Record<string, number>
  soulTraitWeights: Record<string, number>
  reasonForBoxingWeights: Record<string, number>
  styleTendencyWeights: Record<string, number>
  physicalProfile: EthnicityPhysicalProfile
}

export interface EthnicitiesData {
  meta: Meta
  ethnicities: Ethnicity[]
}
```

Add to `src/types/data/index.ts`.

---

## Part 4 — Update Person Type

**Update `packages/engine/src/types/person.ts`**

Add `ethnicityId: string | null` field to `Person` interface.

```typescript
export interface Person {
  // ... existing fields ...
  ethnicityId: string | null
  // null for nations without ethnicity system (Latvia)
  // string referencing ethnicities.json id for nations that use it (USA)
}
```

---

## Part 5 — Update Loader

**Update `packages/engine/src/data/loader.ts`**

Add to `NationBundle`:
```typescript
ethnicities: EthnicitiesData | null
// null for nations without ethnicities file — Latvia
// Loaded if nations/[id]/ethnicities.json exists
```

Loader must handle missing ethnicities file gracefully — Latvia has no ethnicities file, this should not cause an error.

---

## Part 6 — Update generatePerson

**Update `packages/engine/src/generation/person.ts`**

Add ethnicity assignment as an early step in generation:

```typescript
// Step 0 (new) — Assign ethnicity if nation has ethnicities defined
// For nations with ethnicities:
//   1. Get all ethnicities for this nation
//   2. Get cityWeights for each ethnicity at this city
//   3. Weighted pick → ethnicityId
//   4. Store on person
// For nations without ethnicities (Latvia):
//   ethnicityId = null
//   continue as before

// Name selection update:
// If ethnicityId !== null → use names.byEthnicity[ethnicityId] pool
// If ethnicityId === null → use existing nation-level name pool

// Soul trait generation update:
// If ethnicity has soulTraitWeights → apply as multipliers on base probabilities
// e.g. african_american has hungry: 1.4 → hungry trait 40% more likely for this person

// Reason for boxing update:
// If ethnicity has reasonForBoxingWeights → apply as multipliers on base probabilities

// Physical attribute generation update:
// If ethnicity has physicalProfile biases → apply to generation ceilings
// e.g. mexican_american chinBias: 1.07 → chin generation ceiling × 1.07
// Cap at absoluteMax from attributes.json (18 for gift-eligible, 20 for others)
```

---

## Part 7 — Update GameConfig

**Update `packages/engine/src/types/gameConfig.ts`**

```typescript
export interface GameConfig {
  playerNationId: string
  playerCityId: string
  includedNations: string[]    // nations to generate — player nation always included
  gymName: string
  playerName: string
  seed: number
  difficulty: string
  startYear: number
}
```

**Update `packages/engine/data/universal/game-config-defaults.json`**

Add `includedNations: ["latvia"]` as default. Add `startYear: 2026`.

---

## Part 8 — Update New Game UI

**Update `packages/ui/src/screens/NewGame.tsx`**

Add nation selection section. Read available nation bundles from game data. Show each as a checkbox with performance hint.

```
WORLD CONFIGURATION
☑ Latvia (your nation)           ~600 fighters · ~2s
☐ United States                  ~2,400 fighters · ~6s

Estimated total: ~600 fighters · ~2s generation time
```

Player nation checkbox is always checked and disabled — cannot deselect your own nation.

Performance estimates pulled from `nation.performanceHint` fields.

---

## Part 9 — Tests

**Update `packages/engine/src/generation/person.test.ts`**

Add tests:
- US person in Brownsville Brooklyn gets ethnicityId assigned
- Mexican-American person gets Spanish first name
- African-American person's chin generation ceiling uses chinBias modifier
- Latvian person has ethnicityId null
- Soul trait probabilities shifted by ethnicity weights
- Same seed → same ethnicity assignment (determinism)

---

### Definition Of Done
- [ ] `universal/reasons-for-boxing.json` — family_tradition and community_identity added
- [ ] `nations/usa/nation.json` — valid JSON, performanceHint included
- [ ] `nations/usa/cities.json` — 20 cities, all modifiers, descriptions
- [ ] `nations/usa/ethnicities.json` — 6 ethnicities, physical profiles, trait weights
- [ ] `nations/usa/names.json` — by ethnicity, 20+ names each pool
- [ ] `nations/usa/economic-statuses.json` — US appropriate
- [ ] `nations/usa/reasons-for-boxing.json` — all reasons including new two
- [ ] `nations/usa/gym-names.json` — 50+ names
- [ ] `nations/usa/coach-generation.json` — higher quality ranges
- [ ] `nations/usa/boxing/sanctioning-bodies.json` — USA Boxing
- [ ] `nations/usa/boxing/amateur-circuit.json` — including Golden Gloves
- [ ] `nations/usa/boxing/usab-rules.json` — USA Boxing rules
- [ ] `nations/usa/boxing/event-templates.json`
- [ ] `nations/usa/boxing/venues.json` — 12+ venues including MGM, MSG
- [ ] `nations/usa/boxing/pro-ecosystem.json` — level 4 start
- [ ] `nations/usa/boxing/promoters.json` — US voice lines
- [ ] `src/types/data/ethnicities.ts` — EthnicitiesData type
- [ ] `src/types/person.ts` — ethnicityId field added
- [ ] Loader updated — ethnicities on NationBundle, null-safe
- [ ] `generatePerson` updated — ethnicity assignment, name pool, trait weights, physical biases
- [ ] `GameConfig` updated — includedNations, startYear
- [ ] New game UI — nation checkboxes with performance hints
- [ ] Person tests updated — 6 new ethnicity tests passing
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing — all existing tests still pass
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: usa nation bundle + ethnicity system`

### Notes
- Data files first — all JSON before touching any TypeScript
- Physical profile biases are multipliers on generation ceilings — never push above absoluteMax
- ethnicityId null for Latvia — loader must handle missing ethnicities.json gracefully
- New game UI nation checkboxes: player nation always checked and disabled
- Golden Gloves is a distinct circuit level in US — historic and prestigious, different from generic national championship
- Brownsville Brooklyn description must capture the weight of that start — hardest in the game
- Detroit must reference Kronk
- All bias comments in ethnicities.json must explain the real-world basis for the modifier
