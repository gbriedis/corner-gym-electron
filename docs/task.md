# Current Task

## Task: Style System — Data Files + Types + Fighter Style Update

### What To Build
Two data files defining style matchups and style development rules. TypeScript types for both. Update Fighter generation to wire style thresholds. No fight simulation yet — data and types only. The engine will read these when the exchange simulation is built.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/rules/data.md`

---

## Part 1 — Data Files

### `packages/engine/data/universal/style-matchups.json`

Full file as designed. Include all 13 matchup entries plus the styleThresholds section.

Structure:
```json
{
  "meta": { ... },
  "styleThresholds": {
    "pressure":       { "stamina": 10, "output_volume": 10, "ring_generalship": 8 },
    "boxer":          { "footwork": 10, "lateral_movement": 9, "ring_generalship": 10 },
    "boxer_puncher":  { "footwork": 8, "combination_fluency": 9, "ring_generalship": 8 },
    "brawler":        { "chin": 8, "durability": 8, "heart": 7 },
    "counterpuncher": { "defensive_skill": 10, "counter_punching": 10, "ring_iq": 9 },
    "swarmer":        { "stamina": 12, "output_volume": 12, "heart": 9 }
  },
  "matchups": [ ... all 13 matchups ... ]
}
```

Each matchup entry must have:
- `id`, `styles` (array of two style ids, or `["same_vs_same"]` for mirror)
- `description`
- `exchangeInitiationAdvantage`: `"styleA"` | `"styleB"` | `"neutral"`
- `distanceControlAdvantage`: same
- `decisiveAttributesA`, `decisiveAttributesB` (arrays of attribute ids)
- `modifiers` (object of named modifier keys to float values)
- `wildcards` (array — conditions that flip or dramatically change fight dynamics)
- `narrativeNotes` (string — what this matchup feels like, used for dev reference)

The 13 matchups:
1. `pressure_vs_boxer`
2. `pressure_vs_brawler`
3. `pressure_vs_counterpuncher`
4. `pressure_vs_swarmer`
5. `boxer_vs_counterpuncher`
6. `boxer_vs_brawler`
7. `boxer_vs_swarmer`
8. `brawler_vs_counterpuncher`
9. `brawler_vs_swarmer`
10. `swarmer_vs_counterpuncher`
11. `boxer_vs_boxer`
12. `mirror_match_generic` (same style vs same style)
13. `undefined_vs_any` (at least one fighter has undefined style — pure attribute fight)

Add `undefined_vs_any`:
```json
{
  "id": "undefined_vs_any",
  "styles": ["undefined"],
  "description": "When a fighter has no defined style yet, the fight is purely attribute-driven. No style modifiers apply. Raw attributes and soul traits decide the outcome.",
  "exchangeInitiationAdvantage": "neutral",
  "distanceControlAdvantage": "neutral",
  "decisiveAttributesA": "all_attributes_equal_weight",
  "decisiveAttributesB": "all_attributes_equal_weight",
  "modifiers": {},
  "wildcards": [],
  "narrativeNotes": "Raw fight. No tactics, no system. The better athlete on the night wins."
}
```

Meta must explain: matchup modifiers are applied when two fighters meet in a bout. tendencyStrength on each fighter scales how much these modifiers apply — 0 means pure attribute fight, 100 means full style expression. styleEffectiveness scales modifiers down when fighter attributes don't support their declared style. The engine looks up matchup by the styles of the two fighters.

---

### `packages/engine/data/universal/style-development.json`

How style develops over time. Full file as designed.

Include:
- `tendencyStrengthGrowth` — per training week (0.3), per amateur bout (1.5), per pro bout (2.0), maximum per year (12)
- `coachInfluence` — shift rates by year with coach, soul trait modifiers, tendency strength resistance formula
- `styleCompatibilityWithAttributes` — references styleThresholds in style-matchups.json, effectiveness formula

Meta must explain: style is never assigned — it emerges and solidifies. A fighter who changes gyms gradually shifts toward the new coach's emphasis. High tendencyStrength resists change. The engine reads this when processing weekly training and when a fighter changes gyms.

---

## Part 2 — TypeScript Types

**`packages/engine/src/types/data/style.ts`**

```typescript
// Types for style-matchups.json and style-development.json

export type StyleTendencyId =
  | 'pressure'
  | 'boxer'
  | 'boxer_puncher'
  | 'brawler'
  | 'counterpuncher'
  | 'swarmer'
  | 'undefined'

export interface StyleThresholds {
  // Minimum attribute values for full style expression.
  // Below threshold: styleEffectiveness = attribute / threshold
  [styleId: string]: Record<string, number>
}

export interface StyleWildcard {
  condition: string
  effect: string
  threshold?: number
  threshold_ringIq?: number
  threshold_outputVolume?: number
  note?: string
}

export interface StyleMatchup {
  id: string
  styles: string[]
  description: string
  exchangeInitiationAdvantage: 'styleA' | 'styleB' | 'neutral'
  distanceControlAdvantage: 'styleA' | 'styleB' | 'neutral'
  decisiveAttributesA: string[] | string
  decisiveAttributesB: string[] | string
  modifiers: Record<string, number>
  wildcards: StyleWildcard[]
  narrativeNotes: string
}

export interface StyleMatchupsData {
  meta: Meta
  styleThresholds: StyleThresholds
  matchups: StyleMatchup[]
}

export interface TendencyStrengthGrowth {
  perTrainingWeek: number
  perAmateur_bout: number
  perPro_bout: number
  maximumPerYear: number
  note: string
}

export interface CoachInfluenceShiftRates {
  newCoach_year1: number
  newCoach_year2: number
  newCoach_year3_plus: number
  note: string
}

export interface CoachInfluence {
  description: string
  shiftPerYear: CoachInfluenceShiftRates
  soulTraitModifiers: Record<string, number>
  tendencyStrengthResistance: { note: string; example: string }
}

export interface StyleDevelopmentData {
  meta: Meta
  tendencyStrengthGrowth: TendencyStrengthGrowth
  coachInfluence: CoachInfluence
  styleCompatibilityWithAttributes: {
    description: string
    effectivenessFormula: string
    note: string
  }
}
```

Add to `src/types/data/index.ts`.

---

## Part 3 — Update Loader

Add to `GameData` in `src/data/loader.ts`:
```typescript
styleMatchups: StyleMatchupsData
styleDevelopment: StyleDevelopmentData
```

Load from:
- `universal/style-matchups.json`
- `universal/style-development.json`

---

## Part 4 — Update Fighter Generation

**Update `packages/engine/src/generation/fighter.ts`**

Add a `calculateStyleEffectiveness` helper:

```typescript
// calculateStyleEffectiveness returns how well a fighter's current attributes
// support their declared style tendency.
// Returns 0.0 to 1.0 — 1.0 means full style expression, below 1.0 means
// the style is limited by attribute gaps.
// The weakest threshold attribute determines overall effectiveness.
// This is used by the exchange simulation — not stored on the fighter.
// Exported so the fight engine can call it per round as attributes degrade.
export function calculateStyleEffectiveness(
  style: FighterStyle,
  developedAttributes: DevelopedAttribute[],
  physicalAttributes: AttributeValue[],
  data: GameData
): number
```

The function:
1. Looks up `styleThresholds[style.currentTendency]` from `data.styleMatchups`
2. For each threshold attribute — checks if it's a developed attribute or physical attribute
3. Calculates `effectiveness = min(1.0, attributeValue / threshold)`
4. Returns the minimum effectiveness across all threshold attributes
5. If style is `undefined` — returns 0 (pure attribute fight, no style modifiers)
6. Multiplies by `style.tendencyStrength / 100` — low strength reduces influence even if attributes support it

Add to `fighter.test.ts`:
- Fighter with undefined style returns 0 effectiveness
- Fighter with all attributes above thresholds returns value > 0.9 (× tendencyStrength factor)
- Fighter with one attribute below threshold is limited by that attribute
- Fighter with tendencyStrength 0 returns 0 regardless of attributes

---

## Part 5 — Lookup Helper

**`packages/engine/src/engine/styleEngine.ts`**

```typescript
// styleEngine provides lookup helpers for the fight simulation.
// The exchange simulation calls these to get the relevant matchup
// and calculate effective modifiers for a specific pair of fighters.

// getMatchup returns the relevant StyleMatchup for two fighter styles.
// If both styles are the same — returns mirror_match_generic.
// If either style is undefined — returns undefined_vs_any.
// Otherwise finds the matchup by matching both style ids regardless of order.
export function getMatchup(
  styleA: StyleTendencyId,
  styleB: StyleTendencyId,
  data: GameData
): StyleMatchup

// getEffectiveModifiers returns the matchup modifiers scaled by both fighters'
// tendency strength and style effectiveness.
// effectiveModifier = baseModifier × styleEffectivenessA × styleEffectivenessB
// This is what the exchange simulation actually uses.
export function getEffectiveModifiers(
  matchup: StyleMatchup,
  effectivenessA: number,
  effectivenessB: number
): Record<string, number>
```

---

### Definition Of Done
- [ ] `universal/style-matchups.json` — 13 matchups + styleThresholds, valid JSON, meta block
- [ ] `universal/style-development.json` — all sections, valid JSON, meta block
- [ ] `src/types/data/style.ts` — all interfaces, added to index.ts
- [ ] Loader updated — styleMatchups and styleDevelopment on GameData
- [ ] `calculateStyleEffectiveness` added to fighter.ts and exported
- [ ] Fighter tests updated — 4 new style effectiveness tests passing
- [ ] `src/engine/styleEngine.ts` — getMatchup and getEffectiveModifiers
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing — all existing tests still pass
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — both files marked `[x]`
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: style system — matchups, development, effectiveness`

### Notes
- Data only in Part 1 — no fight simulation
- styleEngine.ts is a helper module — it does not simulate anything, only looks up and calculates
- calculateStyleEffectiveness multiplies effectiveness by tendencyStrength/100 — both matter
- undefined style = 0 effectiveness = pure attribute fight, no modifiers
- mirror_match_generic applies when both fighters share any style (not just boxer vs boxer)
- Comment why on every non-obvious calculation
