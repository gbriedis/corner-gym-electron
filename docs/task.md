# Current Task

## Task: Bout Resolution Engine — Statistical Resolution + Attribute Events

### What To Build
The statistical bout resolution engine. This is what the backrun uses to simulate every bout. No exchange log — just result and attribute changes. Fast, deterministic, reads rules from data files.

Exchange simulation (the watched fight) comes later and wraps this.

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## Architecture

```
resolveBout(input) → BoutResolutionResult

BoutResolutionResult {
  winnerId: string | null
  method: BoutMethod
  endRound: number
  judgeScores?: JudgeScorecard[]
  roundDominance: number[]      // per round, -1.0 to 1.0 (positive = fighter A winning)
  fighterAAttributeEvents: AttributeHistoryEvent[]
  fighterBAttributeEvents: AttributeHistoryEvent[]
  fighterADamageAccumulated: DamageAccumulated
  fighterBDamageAccumulated: DamageAccumulated
}
```

`resolveBout` is the single source of truth for bout outcomes. The future exchange simulation wraps it — the fight already happened, the simulation is the storytelling layer on top.

---

## Part 1 — Types

**`packages/engine/src/types/resolution.ts`**

```typescript
// Types for bout resolution. These are the outputs of resolveBout —
// consumed by the backrun engine, the SQLite layer, and eventually
// the exchange simulation layer.

export interface BoutResolutionInput {
  boutId: string
  fighterA: Fighter
  fighterB: Fighter
  coachA: Coach | null
  coachB: Coach | null
  circuitLevel: string
  ageCategoryId: string
  eventId: string
  year: number
  week: number
}

export interface RoundScore {
  roundNumber: number
  fighterAScore: number      // 10-point must — winner gets 10, loser gets 9 or less
  fighterBScore: number
  dominance: number          // -1.0 to 1.0. Positive = A winning round. Used for narrative.
  knockdownsA: number
  knockdownsB: number
  stoppageOccurred: boolean
  stoppageReason?: 'ko' | 'tko_referee' | 'tko_corner' | 'tko_cuts' | 'three_knockdown_rule'
  stoppageFighterId?: string  // who was stopped
}

export interface DamageAccumulated {
  // Damage state at end of bout — affects fighter health going forward
  totalPunchesAbsorbed: number
  knockdowns: number
  chinDamage: number         // 0-100. High = chin more vulnerable in future bouts.
  handDamage: number         // 0-100. High = reduced punch output in future bouts.
  overallWear: number        // 0-100. General accumulated damage.
}

export interface BoutResolutionResult {
  boutId: string
  winnerId: string | null    // null = draw
  loserId: string | null
  method: 'ko' | 'tko' | 'decision' | 'split_decision' | 'majority_decision' | 'draw' | 'no_contest'
  endRound: number
  scheduledRounds: number
  roundScores: RoundScore[]
  judgeScores: JudgeScorecard[]
  fighterADamage: DamageAccumulated
  fighterBDamage: DamageAccumulated
  fighterAAttributeEvents: AttributeHistoryEvent[]
  fighterBAttributeEvents: AttributeHistoryEvent[]
}

export interface JudgeScorecard {
  judgeIndex: number         // 1, 2, or 3
  fighterATotal: number
  fighterBTotal: number
  winnerId: string | null
}
```

Add to `src/types/index.ts`.

---

## Part 2 — Pre-Fight Assessment

**`packages/engine/src/engine/boutAssessment.ts`**

```typescript
// boutAssessment derives everything the resolution engine needs
// before the first round begins. Reads rules from data files —
// nothing about bout conditions is hardcoded here.
//
// The rules file determines:
// - How many rounds and how long they are
// - Whether headgear reduces damage
// - Whether standing eight count gives recovery time
// - Whether three knockdown rule ends fights early
// - Glove weight damage multiplier
//
// This is why every bout result can differ between circuit levels
// with the same two fighters — the conditions shape the outcome.

export interface FighterBoutState {
  fighter: Fighter
  coach: Coach | null

  // Derived from rules + fighter state
  effectiveDamageMultiplier: number   // reduced by glove weight and headgear
  staminaBaseline: number             // 0-100, depletes per round
  styleEffectiveness: number          // from calculateStyleEffectiveness
  healthModifiers: {
    chinModifier: number              // reduced if chin health is damaged
    handOutputModifier: number        // reduced if hand health is damaged
    overallDurabilityModifier: number
  }
}

export interface BoutConditions {
  rules: CircuitRules               // from lbf-rules.json / eubc-rules.json / iba-rules.json
  scheduledRounds: number
  roundDurationMinutes: number
  gloveDamageMultiplier: number     // derived from gloveWeightOz — heavier = less damage
  headgearDamageMultiplier: number  // 1.0 if no headgear, 0.75 if headgear required
  standingEightAvailable: boolean
  threeKnockdownRule: boolean
  matchup: StyleMatchup
  effectiveModifiers: Record<string, number>
}

export function assessBout(
  input: BoutResolutionInput,
  data: GameData
): { fighterAState: FighterBoutState; fighterBState: FighterBoutState; conditions: BoutConditions }
```

### Glove weight to damage multiplier:
```
8oz  → 1.10  (lighter gloves, more damage — rare, some pro fights)
10oz → 1.00  (standard, baseline)
12oz → 0.90
16oz → 0.80  (heavy training gloves, significant damage reduction)
```

Comment: heavier gloves distribute force across a larger surface area, reducing both cutting and concussive impact. This is why amateur bouts with 10oz gloves and headgear produce far less accumulated damage than pro bouts.

### Health state modifiers:
Read from fighter's health values (hands, chin, jaw from Person.health):
```
chinHealth < 50  → chinModifier = 0.7  (damaged chin takes more concussive damage)
chinHealth < 25  → chinModifier = 0.5
handHealth < 50  → handOutputModifier = 0.8  (sore hands reduce output volume)
handHealth < 25  → handOutputModifier = 0.6
```

---

## Part 3 — Round Resolution

**`packages/engine/src/engine/roundResolution.ts`**

```typescript
// roundResolution calculates what happens in a single round.
// Called per round by resolveBout until stoppage or scheduled rounds complete.
//
// The round produces:
// - A dominance score (-1.0 to 1.0) reflecting who controlled the round
// - Damage dealt to each fighter
// - Knockdown events if any
// - Stoppage if conditions are met
// - Updated stamina for both fighters
//
// Soul traits affect in-fight behavior:
// - brave: knockdown recovery probability +20%
// - craven: when hurt, output drops 30%, stoppage probability increases
// - determined: if losing on cards after round 6, output +15%
// - fragile: after a bad round (dominance < -0.5), next round composure -20%
// - hungry: in title fights and above, output +10%
// - content: when ahead by 3+ rounds, output -10% (unconscious easing off)
// - reckless: output +15% but defensive gaps +20% — high variance
// - patient: when behind on cards, does NOT panic — maintains game plan

export interface RoundInput {
  roundNumber: number
  fighterAState: FighterBoutState
  fighterBState: FighterBoutState
  conditions: BoutConditions
  fighterAStamina: number      // current stamina at start of this round
  fighterBStamina: number
  fighterAKnockdowns: number   // cumulative knockdowns this bout
  fighterBKnockdowns: number
  fighterARoundsWon: number    // for soul trait adjustments (determined, content)
  fighterBRoundsWon: number
  rng: RNG
  data: GameData
}

export interface RoundResult {
  roundScore: RoundScore
  fighterAStaminaEnd: number
  fighterBStaminaEnd: number
  fighterADamageThisRound: number
  fighterBDamageThisRound: number
}

export function resolveRound(input: RoundInput): RoundResult
```

### Round dominance calculation:

```
// Base dominance from attribute comparison weighted by matchup
baseA = (
  fighterA.developedAttributes.ring_generalship × 0.20 +
  fighterA.developedAttributes.technique         × 0.15 +
  fighterA.developedAttributes.punch_selection   × 0.15 +
  fighterA.developedAttributes.defensive_skill   × 0.15 +
  fighterA.physical.power                        × 0.10 +
  fighterA.physical.hand_speed                   × 0.10 +
  fighterA.developedAttributes.output_volume     × 0.10 +
  fighterA.developedAttributes.ring_iq           × 0.05
)

// Apply effective matchup modifiers
// Apply stamina modifier — below 50% stamina reduces output_volume contribution
// Apply health modifiers
// Apply soul trait in-fight modifiers
// Apply style effectiveness

dominance = (baseA - baseB) / maxPossibleDifference  // normalised to -1.0 to 1.0
```

### Knockdown check:
```
// Triggered when damage in an exchange exceeds chin threshold
// chinThreshold = fighter.physical.chin × conditions.chinModifier × 2
// knockdownRoll < (damageDealt - chinThreshold) / chinThreshold
// Recovery: brave +0.2, craven -0.2, heart contributes directly
// Three knockdown rule: if fighterKnockdowns >= 3 AND threeKnockdownRule → stoppage
```

### Stamina depletion per round:
```
// Base depletion: 8 points per round for 3-round amateur bout
// Scaled by round duration: longer rounds deplete more
// Output volume multiplier: higher output = faster depletion
// Stamina below 50%: output_volume contribution to dominance reduced proportionally
// Stamina below 25%: output_volume contribution halved, footwork contribution halved
// disciplined soul trait: depletion × 0.85 (trains efficiently, wastes less energy)
// reckless soul trait: depletion × 1.20 (burns energy with reckless output)
```

### Scoring variance for close rounds:
```
// abs(dominance) > 0.3 → clear round, deterministic scoring (10-9)
// abs(dominance) <= 0.3 → close round
//   each judge independently: roll ± 0.15 variance on dominance
//   judge can score 10-9 for either fighter or 10-10 if truly equal
// Judges score independently — split and majority decisions emerge naturally
```

---

## Part 4 — Main Resolution Function

**`packages/engine/src/engine/resolveBout.ts`**

```typescript
// resolveBout is the single source of truth for bout outcomes.
// Used by the backrun for every historical bout.
// Used by the live simulation as the result layer beneath the exchange narrative.
//
// Produces a deterministic result from the same seed — the same two fighters
// in the same conditions always produce the same outcome.
// This is critical for the backrun: world history must be reproducible.

import { assessBout } from './boutAssessment.js'
import { resolveRound } from './roundResolution.js'
import { calculateAttributeEvents } from './attributeEvents.js'

export function resolveBout(
  input: BoutResolutionInput,
  data: GameData,
  rng: RNG
): BoutResolutionResult
```

### Resolution flow:
```
1. assessBout → fighterAState, fighterBState, conditions
2. for each round (1 to scheduledRounds):
   a. resolveRound → roundResult
   b. if roundResult.roundScore.stoppageOccurred → record result, break
   c. update stamina, knockdown counts
   d. collect round scores
3. if no stoppage → tally judge scorecards → winner or draw
4. calculateAttributeEvents for both fighters based on:
   - result (win/loss/draw)
   - method (KO loss vs decision loss vs decision win)
   - opposition quality (relative attribute comparison)
   - circuit level (amateur vs pro vs title fight)
   - soul traits of each fighter
5. return BoutResolutionResult
```

---

## Part 5 — Attribute Events From Bout

**`packages/engine/src/engine/attributeEvents.ts`**

```typescript
// calculateAttributeEvents derives attribute history events from a completed bout.
// Reads gain rules from attribute-accumulation.json.
// Soul trait multipliers applied here — humble fighter gains more from a loss,
// fragile fighter's composure regresses after a stoppage loss.
//
// Returns AttributeHistoryEvent[] for each fighter — to be applied to their
// attributeHistory records after the bout is saved.

export function calculateAttributeEvents(
  fighter: Fighter,
  result: 'win' | 'loss' | 'draw',
  method: BoutMethod,
  oppositionQuality: number,   // 0-100, relative to fighter
  circuitLevel: string,
  data: GameData
): AttributeHistoryEvent[]
```

### Logic:
1. Determine event type: `amateur_bout`, `pro_bout`, `title_fight`, or `olympic_bout`
2. Get base gains from `data.attributeAccumulation.eventBaseGains[eventType]`
3. Apply `resultModifiers` for win/loss/stoppage_loss
4. Apply `oppositionQualityMultipliers` based on relative quality
5. Apply `soulTraitMultipliers` for each relevant trait the fighter has
6. Cap each gain at `singleEventGainCap[eventType]`
7. Return as `AttributeHistoryEvent[]` with trigger, delta, oppositionQuality, year, week

---

## Part 6 — Tests

**`packages/engine/src/engine/resolveBout.test.ts`**

Tests:
- Same seed + same fighters → same result (determinism)
- Fighter with significantly higher attributes wins majority of bouts (run 20 times)
- KO possible when power differential is large and chin is low
- Amateur bout with headgear produces less damage than pro bout same fighters
- Three knockdown rule ends bout when applicable
- Decision result when no stoppage occurs
- Split decision possible on close fights
- Attribute events generated for both fighters after every bout
- Winner receives win attribute gains, loser receives loss gains
- Stoppage loss produces composure regression for fragile fighter
- Stamina depletion affects later rounds — high stamina fighter performs better in rounds 6+

---

### Definition Of Done
- [ ] `src/types/resolution.ts` — all resolution types, exported from index.ts
- [ ] `src/engine/boutAssessment.ts` — assessBout with rules loading and health modifiers
- [ ] `src/engine/roundResolution.ts` — resolveRound with stamina, knockdowns, scoring variance
- [ ] `src/engine/resolveBout.ts` — full resolution flow, deterministic
- [ ] `src/engine/attributeEvents.ts` — calculateAttributeEvents reading accumulation rules
- [ ] `src/engine/resolveBout.test.ts` — all listed tests passing
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing — all 145 existing tests still pass
- [ ] `docs/structure.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: bout resolution engine — statistical resolution`

### Notes
- Read engine skill fully before writing any code
- resolveBout must be deterministic — same seed always produces same result
- Rules come from data files — nothing about bout conditions hardcoded
- Glove weight and headgear directly affect damage calculation — comment why
- Soul traits affect in-fight behavior — document each one in roundResolution.ts
- attributeEvents.ts reads from attribute-accumulation.json — no hardcoded gain values
- Three knockdown rule only applies if rules.threeKnockdownRule is true — check rules file
- Standing eight count recovery: if available, gives hurt fighter partial stamina recovery before round continues
