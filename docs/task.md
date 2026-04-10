# Current Task

## Task: Attribute Accumulation Data + Coach Style Data + Stub Types

### What To Build
Two data files and four stub TypeScript types. No engine logic yet. Data defines the rules. Stubs unblock the Fighter type.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/rules/data.md`

---

## Part 1 — Data Files

### `packages/engine/data/universal/attribute-accumulation.json`

The complete rules file for how attributes grow, regress, and start. Every attribute change in the simulation flows through this. Full file content defined below — implement exactly as specified.

```json
{
  "meta": {
    "version": "1.0.0",
    "description": "Rules governing how fighter attributes accumulate, regress, and initialise. Every attribute change in the simulation flows through these rules. Values are tuning parameters — they live in data not code so they can be adjusted without touching the engine. The engine reads this file once at startup and applies it throughout the simulation. Training gains are shaped by coach quality, coach style compatibility, sparring partner quality, and gym quality — all defined here as multiplier ranges."
  },

  "eventBaseGains": {
    "training_session": {
      "applicableAttributes": [
        "technique", "combination_fluency", "punch_selection", "defensive_skill",
        "footwork", "lateral_movement", "ring_generalship", "output_volume",
        "body_punch_effectiveness", "counter_punching", "finishing_instinct"
      ],
      "gains": {
        "technique": 0.3,
        "combination_fluency": 0.2,
        "punch_selection": 0.2,
        "defensive_skill": 0.2,
        "footwork": 0.2,
        "lateral_movement": 0.15,
        "ring_generalship": 0.1,
        "output_volume": 0.15,
        "body_punch_effectiveness": 0.15,
        "counter_punching": 0.1,
        "finishing_instinct": 0.1
      },
      "mentalGains": null,
      "note": "Training cannot grow mental attributes — ring_iq, composure, heart, big_fight_experience, adaptability only grow through actual competition. You cannot train your way to mental toughness."
    },
    "sparring": {
      "applicableAttributes": [
        "technique", "combination_fluency", "punch_selection", "defensive_skill",
        "footwork", "lateral_movement", "ring_generalship", "counter_punching",
        "ring_iq", "composure", "adaptability"
      ],
      "gains": {
        "technique": 0.2,
        "combination_fluency": 0.15,
        "punch_selection": 0.2,
        "defensive_skill": 0.25,
        "footwork": 0.15,
        "lateral_movement": 0.15,
        "ring_generalship": 0.2,
        "counter_punching": 0.2,
        "ring_iq": 0.15,
        "composure": 0.05,
        "adaptability": 0.1
      },
      "note": "Sparring grows ring_iq and adaptability slightly — real pressure even if controlled. Composure barely moves — sparring is not a real fight. Sparring partner quality multiplier applies here."
    },
    "amateur_bout": {
      "gains": {
        "technique": 0.3,
        "combination_fluency": 0.25,
        "punch_selection": 0.3,
        "defensive_skill": 0.3,
        "ring_generalship": 0.35,
        "counter_punching": 0.25,
        "finishing_instinct": 0.2,
        "ring_iq": 0.4,
        "composure": 0.3,
        "adaptability": 0.35,
        "heart": 0.2,
        "big_fight_experience": 0.1,
        "output_volume": 0.2
      },
      "note": "Amateur bouts produce meaningful mental growth. big_fight_experience grows slowly — most amateur bouts are not big fights. Opposition quality multiplier applies."
    },
    "pro_bout": {
      "gains": {
        "technique": 0.25,
        "combination_fluency": 0.2,
        "punch_selection": 0.35,
        "defensive_skill": 0.3,
        "ring_generalship": 0.4,
        "counter_punching": 0.3,
        "finishing_instinct": 0.3,
        "ring_iq": 0.5,
        "composure": 0.4,
        "adaptability": 0.45,
        "heart": 0.35,
        "big_fight_experience": 0.25,
        "output_volume": 0.2
      },
      "note": "Pro bouts produce larger mental gains than amateur. The stakes are real."
    },
    "title_fight": {
      "inheritsFrom": "pro_bout",
      "overallMultiplier": 1.5,
      "additionalGains": {
        "big_fight_experience": 0.8,
        "composure": 0.6,
        "heart": 0.5
      },
      "note": "Title fights amplify all pro_bout gains. The occasion teaches something ordinary pro fights cannot."
    },
    "olympic_bout": {
      "inheritsFrom": "amateur_bout",
      "overallMultiplier": 1.3,
      "additionalGains": {
        "big_fight_experience": 1.0,
        "composure": 0.8,
        "heart": 0.6
      },
      "note": "Olympic bouts are the ceiling of big_fight_experience in the amateur world. One Olympic bout grows big_fight_experience more than ten regional bouts."
    }
  },

  "resultModifiers": {
    "win": {
      "multiplier": 1.0
    },
    "loss": {
      "multiplier": 0.7,
      "attributeOverrides": {
        "ring_iq": 1.2,
        "adaptability": 1.3,
        "composure": 0.5
      },
      "note": "A loss produces less overall gain but more ring_iq and adaptability if the fighter processes it. Soul trait modifiers determine how much actually lands."
    },
    "stoppage_loss": {
      "multiplier": 0.4,
      "attributeOverrides": {
        "composure": -0.5,
        "heart": -0.3,
        "ring_iq": 0.8
      },
      "note": "Getting stopped is harder to process. Composure and heart can regress. Soul traits determine whether the fighter comes back stronger or diminished."
    }
  },

  "oppositionQualityMultipliers": {
    "significantly_better": { "thresholdRatio": 0.8, "multiplier": 1.8 },
    "better": { "thresholdRatio": 0.9, "multiplier": 1.4 },
    "matched": { "thresholdRatio": 1.1, "multiplier": 1.0 },
    "weaker": { "thresholdRatio": 1.3, "multiplier": 0.5 },
    "significantly_weaker": { "thresholdRatio": null, "multiplier": 0.2 },
    "note": "thresholdRatio is opponent overall level divided by fighter overall level. Below 0.8 means opponent is significantly better. Above 1.3 means fighter is significantly better."
  },

  "trainingEnvironmentMultipliers": {
    "description": "Multipliers applied to training_session and sparring gains only. Fight gains are not affected by gym environment — the fight itself is the environment.",

    "coachQuality": {
      "description": "Head coach quality directly multiplies all technical gains from training. Quality is a 1-20 value on the coach record.",
      "scale": [
        { "qualityRange": [1, 5],   "multiplier": 0.5,  "label": "Poor — limits fighter development" },
        { "qualityRange": [6, 9],   "multiplier": 0.75, "label": "Below average" },
        { "qualityRange": [10, 13], "multiplier": 1.0,  "label": "Competent — baseline" },
        { "qualityRange": [14, 17], "multiplier": 1.3,  "label": "Good — accelerates development" },
        { "qualityRange": [18, 20], "multiplier": 1.6,  "label": "Elite — maximum extraction from every session" }
      ],
      "note": "A gym member filling the coaching role uses quality 1-6 by default. Hired coaches have quality reflecting their real level."
    },

    "coachStyleCompatibility": {
      "description": "How well the coach style matches the fighter's soul traits. Compatibility multiplies all training gains on top of coach quality.",
      "compatibilityMatrix": {
        "emphasis_technical_x_humble":       { "multiplier": 1.3, "note": "Humble fighter absorbs technical instruction perfectly" },
        "emphasis_technical_x_arrogant":     { "multiplier": 0.7, "note": "Arrogant fighter resists being corrected" },
        "emphasis_pressure_x_brave":         { "multiplier": 1.2, "note": "Brave fighter thrives in pressure-focused sessions" },
        "emphasis_pressure_x_craven":        { "multiplier": 0.6, "note": "Craven fighter struggles with pressure methodology" },
        "emphasis_defensive_x_patient":      { "multiplier": 1.3, "note": "Patient fighter naturally suits defensive style" },
        "emphasis_defensive_x_impatient":    { "multiplier": 0.7, "note": "Impatient fighter fights the defensive approach" },
        "methodology_disciplined_x_disciplined": { "multiplier": 1.3, "note": "Disciplined coach and disciplined fighter — maximum consistency" },
        "methodology_disciplined_x_reckless":    { "multiplier": 0.7, "note": "Reckless fighter chafes under rigid structure" },
        "methodology_freestyle_x_reckless":      { "multiplier": 1.2, "note": "Freestyle methodology suits reckless energy" },
        "methodology_freestyle_x_disciplined":   { "multiplier": 0.9, "note": "Disciplined fighter prefers more structure" },
        "communication_demanding_x_determined":  { "multiplier": 1.2, "note": "Determined fighter responds to high standards" },
        "communication_demanding_x_fragile":     { "multiplier": 0.5, "note": "Demanding coach can break a fragile fighter" },
        "communication_supportive_x_fragile":    { "multiplier": 1.4, "note": "Supportive coach is exactly what a fragile fighter needs" },
        "communication_supportive_x_arrogant":   { "multiplier": 0.7, "note": "Arrogant fighter dismisses supportive coaching as weak" },
        "communication_detached_x_trusting":     { "multiplier": 0.8, "note": "Trusting fighter needs more engagement than detached coach provides" },
        "communication_detached_x_paranoid":     { "multiplier": 1.1, "note": "Paranoid fighter is comfortable with a coach who doesn't crowd them" }
      },
      "defaultCompatibility": 1.0,
      "note": "If no specific compatibility rule matches, default 1.0 applies. Multiple compatible traits stack multiplicatively up to a cap of 2.0."
    },

    "sparringPartnerQuality": {
      "description": "Quality of sparring partners available in the gym. Uses same scale as opposition quality — relative to fighter level.",
      "scale": [
        { "relativeLevel": "significantly_better", "multiplier": 1.5 },
        { "relativeLevel": "better",               "multiplier": 1.2 },
        { "relativeLevel": "matched",              "multiplier": 1.0 },
        { "relativeLevel": "weaker",               "multiplier": 0.6 },
        { "relativeLevel": "no_sparring",          "multiplier": 0.3, "note": "Training without sparring severely limits development" }
      ]
    },

    "gymQuality": {
      "description": "Physical gym environment multiplier. Derived from equipment condition and available facilities. A gym without a ring cannot develop ring generalship or footwork properly.",
      "scale": [
        { "qualityScore": [1, 20],  "multiplier": 0.6,  "label": "Rundown — equipment worn, no ring, limited space" },
        { "qualityScore": [21, 40], "multiplier": 0.75, "label": "Basic — functional but limited" },
        { "qualityScore": [41, 60], "multiplier": 0.9,  "label": "Decent — ring exists, equipment maintained" },
        { "qualityScore": [61, 80], "multiplier": 1.0,  "label": "Good — full facilities, well maintained" },
        { "qualityScore": [81, 100],"multiplier": 1.15, "label": "Elite — best equipment, optimal environment" }
      ],
      "note": "Gym quality score is calculated from equipment condition, available facilities, and maintenance state. A gym with no ring caps ring_generalship and footwork gains at 0.5× regardless of this multiplier."
    }
  },

  "soulTraitMultipliers": {
    "brave":      { "appliesTo": ["heart", "composure", "big_fight_experience"], "gainMultiplier": 1.3 },
    "craven":     { "appliesTo": ["heart", "composure"], "gainMultiplier": 0.6, "regressionMultiplier": 1.5 },
    "humble":     { "appliesTo": ["technique", "ring_iq", "adaptability", "defensive_skill"], "gainMultiplier": 1.4, "lossGainMultiplier": 1.6 },
    "arrogant":   { "appliesTo": ["technique", "ring_iq", "adaptability"], "gainMultiplier": 0.7, "lossGainMultiplier": 0.4 },
    "patient":    { "appliesTo": ["ring_generalship", "punch_selection", "counter_punching"], "gainMultiplier": 1.3 },
    "impatient":  { "appliesTo": ["ring_generalship", "punch_selection"], "gainMultiplier": 0.7, "outputVolumeBonus": 0.2 },
    "trusting":   { "appliesTo": "all_technical", "coachingMultiplier": 1.3 },
    "paranoid":   { "appliesTo": "all_technical", "coachingMultiplier": 0.7 },
    "disciplined":{ "appliesTo": "all", "inactivityRegressionMultiplier": 0.5, "trainingConsistencyBonus": 0.1 },
    "reckless":   { "appliesTo": "all", "gainVariance": 0.4, "note": "High variance — some sessions exceptional, some nothing. Roll variance against this value to determine session outcome." },
    "determined": { "appliesTo": ["heart", "adaptability", "composure"], "stoppageRecoveryMultiplier": 1.5 },
    "fragile":    { "appliesTo": ["heart", "composure"], "stoppageRegressionMultiplier": 2.0 },
    "hungry":     { "appliesTo": ["heart", "output_volume", "finishing_instinct"], "highStakesMultiplier": 1.4 },
    "content":    { "appliesTo": ["heart", "output_volume"], "highStakesMultiplier": 0.8, "ceilingEffect": true, "note": "Content fighters stop pushing before reaching their potential. Their effective ceiling is 90% of genetic ceiling." }
  },

  "inactivityRegression": {
    "amateur": {
      "regressionStartsWeeks": 12,
      "ratePerWeek": { "technical": 0.05, "mental": 0.08, "physical_non_genetic": 0.03 }
    },
    "pro": {
      "regressionStartsWeeks": 20,
      "ratePerWeek": { "technical": 0.04, "mental": 0.06, "physical_non_genetic": 0.02 }
    },
    "retired": {
      "regressionStartsWeeks": 0,
      "ratePerWeek": { "technical": 0.1, "mental": 0.05, "physical_non_genetic": 0.08 }
    },
    "physicalGeneticRegression": {
      "baselineStartAge": 32,
      "ratePerYear": {
        "power": 0.3, "hand_speed": 0.4, "stamina": 0.3,
        "chin": 0.2, "durability": 0.2, "recovery_rate": 0.35,
        "footwork": 0.25, "lateral_movement": 0.3
      },
      "note": "Development profile modifies baseline start age. Early bloomers start fading at 29, late bloomers at 35."
    }
  },

  "singleEventGainCap": {
    "training_session": 0.5,
    "sparring": 0.4,
    "amateur_bout": 1.5,
    "pro_bout": 2.0,
    "title_fight": 3.0,
    "olympic_bout": 3.0,
    "note": "Maximum any single event can move one attribute regardless of all multipliers stacked. Prevents unrealistic jumps. An Olympic gold can move big_fight_experience by up to 3 points — but accumulated experience across a career is the only path to the ceiling."
  },

  "startingValueFormula": {
    "baseByYearsTraining": {
      "0": 1, "1": 2, "2": 3, "3": 4, "5": 5, "7": 6, "10": 7,
      "note": "Base developed attribute value by years of training. Linear interpolation between listed breakpoints."
    },
    "mentalAttributeStartingCap": {
      "noBouts": 3,
      "fewBouts_1_to_5": 5,
      "experienced_6_to_20": 10,
      "veteran_21_plus": 14,
      "note": "Mental attributes are hard-capped at generation based on bout history. A fighter with no bouts cannot have ring_iq above 3 regardless of training years. Only fighting breaks through this cap."
    },
    "backgroundModifiers": {
      "selfTaught": -1,
      "priorGym": 2,
      "note": "Self-taught fighters start lower on technical attributes. Prior gym fighters start higher."
    }
  }
}
```

---

### `packages/engine/data/universal/coach-styles.json`

Defines coach style dimensions. Referenced by the compatibility matrix in attribute-accumulation.json and by the Coach type.

```json
{
  "meta": {
    "version": "1.0.0",
    "description": "Coach style dimensions. Every coach has an emphasis, methodology, and communication style. These interact with fighter soul traits via the compatibilityMatrix in attribute-accumulation.json to produce training gain multipliers. Coach style also shapes gym identity over time — changing head coach gradually shifts what the gym produces."
  },
  "emphasisTypes": [
    { "id": "technical",   "label": "Technical",   "description": "Prioritises technique, precision, defence. Produces boxers." },
    { "id": "pressure",    "label": "Pressure",    "description": "Prioritises output, aggression, forward movement. Produces pressure fighters." },
    { "id": "physical",    "label": "Physical",    "description": "Prioritises conditioning, strength, durability. Produces physically dominant fighters." },
    { "id": "defensive",   "label": "Defensive",   "description": "Prioritises avoiding shots, counter punching, ring generalship. Produces defensive specialists." },
    { "id": "balanced",    "label": "Balanced",    "description": "No strong emphasis. Develops fighters more broadly. Lower ceiling in any one area." }
  ],
  "methodologyTypes": [
    { "id": "disciplined", "label": "Disciplined", "description": "Strict, structured sessions. Same drills, same patterns, high repetition. Works well with disciplined fighters." },
    { "id": "freestyle",   "label": "Freestyle",   "description": "Adaptive, responsive sessions. Drills change based on what the fighter needs that day. Works well with reckless fighters." },
    { "id": "structured",  "label": "Structured",  "description": "Planned but flexible. Between disciplined and freestyle. Works with most fighters." }
  ],
  "communicationTypes": [
    { "id": "demanding",   "label": "Demanding",   "description": "High expectations, direct feedback, no tolerance for excuses. Can break fragile fighters, elevates determined ones." },
    { "id": "supportive",  "label": "Supportive",  "description": "Encouragement-led, builds confidence, focuses on positives. Essential for fragile fighters, occasionally too soft for arrogant ones." },
    { "id": "detached",    "label": "Detached",    "description": "Professional, minimal personal engagement. Lets fighters find their own way within the structure. Works for paranoid fighters who don't want to be crowded." }
  ]
}
```

---

## Part 2 — Stub TypeScript Types

Four stub types that Fighter needs to reference. Minimal — just enough for Fighter to compile. Full implementation comes when each system is built.

**`packages/engine/src/types/gym.ts`**

```typescript
// Gym stub — full implementation when gym system is built.
// Fighter references gymId — this type makes that reference valid.

export interface Gym {
  id: string
  name: string
  cityId: string
  nationId: string
  isPlayerGym: boolean
  // Full gym fields added when gym system is built
}
```

**`packages/engine/src/types/coach.ts`**

```typescript
// Coach stub — full implementation when staff system is built.
// A coach is a Person with a coaching role and a defined style.
// Fighter references coachId — this type makes that reference valid.

export interface CoachStyle {
  emphasis: 'technical' | 'pressure' | 'physical' | 'defensive' | 'balanced'
  methodology: 'disciplined' | 'freestyle' | 'structured'
  communicationStyle: 'demanding' | 'supportive' | 'detached'
}

export interface Coach {
  id: string
  personId: string   // references Person — coach is a person first
  gymId: string
  quality: number    // 1-20
  style: CoachStyle
  // Full coach fields added when staff system is built
}
```

**`packages/engine/src/types/manager.ts`**

```typescript
// Manager stub — full implementation when pro career system is built.
// A manager handles fighter business at pro level — separate from gym and promoter.
// Fighter references managerId — this type makes that reference valid.

export interface Manager {
  id: string
  name: string
  reputation: number   // 0-100
  nationality: string
  // Full manager fields added when pro career system is built
}
```

**`packages/engine/src/types/clause.ts`**

```typescript
// Clause stub — references pro-fight-offer.json clause types.
// Fighter.competition.pro.activeClauses uses this type.

export interface Clause {
  type: string   // references clauseTypes id in pro-fight-offer.json
  details: Record<string, unknown>
  expiresYear?: number
  expiresWeek?: number
}
```

Add all four to `src/types/index.ts`.

---

### Definition Of Done
- [ ] `universal/attribute-accumulation.json` — complete file as specified
- [ ] `universal/coach-styles.json` — emphasis, methodology, communication types
- [ ] `src/types/gym.ts` — stub only
- [ ] `src/types/coach.ts` — stub with CoachStyle interface
- [ ] `src/types/manager.ts` — stub only
- [ ] `src/types/clause.ts` — stub only
- [ ] All four stubs exported from `src/types/index.ts`
- [ ] Both JSON files valid, meta blocks present
- [ ] `pnpm typecheck` clean
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — both JSON files marked `[x]`, stub types marked `[~]`
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: attribute accumulation rules + coach styles + stub types`

### Notes
- Data files only in Part 1 — no engine logic
- Stubs in Part 2 are intentionally minimal — do not add fields beyond what is specified
- Mark stub types as `[~]` in data-registry — they exist but are not complete
- The compatibility matrix keys in attribute-accumulation.json must exactly match the ids in coach-styles.json
- coach-styles.json emphasis/methodology/communication ids must be consistent strings used everywhere
