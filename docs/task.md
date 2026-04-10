# Current Task

## Task: Pro Boxing Infrastructure Data Files

### What To Build
Pro boxing data files. No engine logic, no TypeScript types yet, no UI. Data only. This completes the boxing world infrastructure — amateur was built first, pro follows the same pattern.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/rules/data.md`

---

## Folder Structure To Create

```
packages/engine/data/
├── universal/
│   ├── promoters.json                    ← world-tier promoters + templates + generic voice pools
│   └── pro-fight-offer.json              ← offer structure and clause type definitions
├── international/
│   └── boxing/
│       ├── pro-sanctioning-bodies.json   ← WBC, WBA, IBF, WBO, Ring Magazine
│       ├── pro-title-belts.json          ← all belts per body per weight class
│       └── pro-rankings-structure.json   ← ranking rules and mechanics
└── nations/
    └── latvia/
        └── boxing/
            └── pro-ecosystem.json        ← Latvia's pro development levels
            └── promoters.json            ← Latvia-specific promoters (empty, emerge procedurally)
```

---

## Files To Create

### `international/boxing/pro-sanctioning-bodies.json`

WBC, WBA, IBF, WBO, Ring Magazine.

Fields per body: `id`, `label`, `abbreviation`, `founded`, `prestige` (1-10), `description`, `titleTiers` (array of tier ids this body awards), `rankingPositions`, `mandatoryDefenceWeeks` (null for Ring Magazine — they issue no titles).

Ring Magazine: prestige 10, no mandatory defence, lineal championship only. Their recognition is the most coveted in boxing even without a sanctioning structure.

Meta must explain: four major sanctioning bodies each operate independently. A fighter can hold multiple world titles simultaneously by winning from different bodies. Ring Magazine is not a sanctioning body — it issues no titles but their lineal designation is considered the truest measure of championship. Rankings and mandatory challengers are tracked per body independently by the engine.

---

### `international/boxing/pro-title-belts.json`

Every belt per body per weight class. This is a large file — cover all combinations.

Bodies: WBC, WBA, IBF, WBO, Ring Magazine.
Weight classes: all 10 from `universal/weight-classes.json` (excluding super_heavyweight which is amateur only).

WBC title tiers per weight class: `world`, `silver`, `international`, `youth`
WBA title tiers per weight class: `super`, `world`, `international`, `fedebol`
IBF title tiers per weight class: `world`, `international`, `youth`
WBO title tiers per weight class: `world`, `intercontinental`, `international`, `youth`
Ring Magazine: `lineal` only — one per weight class

Fields per belt: `id`, `sanctioningBodyId`, `tier`, `weightClassId`, `label`, `prestige` (1-10 scale — world titles 9-10, regional 5-7, international 3-5, youth 2-3, lineal 10), `description`, `currentHolderId` (null — populated during world generation), `vacated` (false), `defenceCount` (0).

Meta must explain: world title belts are the highest achievement in pro boxing per sanctioning body. The Ring Magazine lineal belt represents the true champion — the fighter who beat the man who beat the man. Multiple world titles can be unified — a unified champion holds belts from multiple bodies simultaneously. The engine tracks holder, defences, and mandatory challenger status per belt.

---

### `international/boxing/pro-rankings-structure.json`

Rules governing how pro rankings work. Not the actual rankings — those live in world state and update dynamically. This defines the mechanics the engine follows.

```json
{
  "rules": {
    "rankedPositions": 15,
    "pointsForWinAgainstRanked": {
      "top5": 100,
      "top10": 60,
      "top15": 30,
      "unranked": 10
    },
    "pointsForLoss": -20,
    "pointsDecayPerWeekInactive": 1,
    "minimumProBoutsToRank": 4,
    "mandatoryDefenceTriggersAtRank": 1,
    "mandatoryDefenceWindowWeeks": 52,
    "strippedIfMandatoryIgnoredWeeks": 16
  },
  "titleShots": {
    "automaticAtRank": 1,
    "promoterCanNegotiateFromRank": 5,
    "interimTitleAvailableWhenChampionInactive": true,
    "inactiveChampionWeeksBeforeInterim": 26
  },
  "acquisitionTiers": [
    {
      "tier": "world",
      "minimumReputation": 80,
      "acquiresFromRank": { "min": 1, "max": 5 }
    },
    {
      "tier": "regional",
      "minimumReputation": 40,
      "acquiresFromRank": { "min": 6, "max": 12 }
    },
    {
      "tier": "local",
      "minimumReputation": 5,
      "acquiresFromRank": { "min": 13, "max": null }
    }
  ]
}
```

`acquisitionTiers` defines which promoter tier can acquire which ranked fighters during world generation — the draft system. World promoters get first pick of top ranked fighters. Local promoters get the rest.

Meta must explain: points decay forces active fighting — a fighter who stops competing loses ranking positions. Mandatory defence window means a champion must defend within 52 weeks or face being stripped. The acquisition tiers govern world generation fighter distribution — not live gameplay.

---

### `nations/latvia/boxing/pro-ecosystem.json`

Latvia's pro boxing development system. Starts at level 0.

```json
{
  "nationId": "latvia",
  "currentLevel": 0,
  "thresholds": [
    {
      "level": 1,
      "label": "Emerging Scene",
      "requirements": {
        "activeProFighters": 3,
        "highestCircuitReached": "european_championship"
      },
      "unlocks": [
        "local_promoter_emerges",
        "informal_pro_cards",
        "small_venue_fights"
      ],
      "inboxMessage": "A local promoter has reached out. Someone is putting together small boxing cards in Riga. The pro scene in Latvia is taking its first steps."
    },
    {
      "level": 2,
      "label": "Recognised Scene",
      "requirements": {
        "activeProFighters": 8,
        "highestCircuitReached": "world_championship",
        "combinedGymReputation": 200
      },
      "unlocks": [
        "wba_continental_sanctioning",
        "wbc_international_sanctioning",
        "latvian_pro_rankings",
        "regional_title_fights"
      ],
      "inboxMessage": "Latvian boxing is getting noticed. Cards in Riga are now being sanctioned at continental level. A Latvian pro ranking exists for the first time."
    },
    {
      "level": 3,
      "label": "Established Scene",
      "requirements": {
        "worldRankedFighters": 2,
        "europeanTitleHeld": true,
        "combinedGymReputation": 500
      },
      "unlocks": [
        "latvian_pro_boxing_commission",
        "national_pro_title_belts",
        "international_promoter_interest",
        "latvian_boxing_on_world_news"
      ],
      "inboxMessage": "The Latvian Pro Boxing Commission has been formally established. National pro titles now exist. International promoters are starting to pay attention."
    },
    {
      "level": 4,
      "label": "Boxing Nation",
      "requirements": {
        "worldTitleContender": true,
        "internationalCardsHosted": 3,
        "combinedGymReputation": 1000
      },
      "unlocks": [
        "full_latvian_sanctioning_body",
        "world_title_fight_eligible",
        "major_promoter_relationships",
        "latvian_boxing_international_radar"
      ],
      "inboxMessage": "Latvia is now a recognised boxing nation. The world is watching. This is what you built."
    }
  ]
}
```

Meta must explain: Latvia has no meaningful domestic pro boxing scene in 2026. Development advances when threshold conditions are met — these are checked weekly by the engine. The player does not control this entity. It responds to what the Latvian boxing world produces. The inbox delivers the moment each level unlocks. Other nations have their own ecosystem files at their real-world starting level — UK, Mexico, USA start at level 4.

---

### `universal/promoters.json`

Full file as proposed in design session. Include:

- 4 named world-tier promoters: `matchroom`, `top_rank`, `queensberry`, `golden_boy`
- 2 promoter templates: `regional_promoter_template`, `local_promoter_template`
- 2 generic voice line pools: `regional_promoter_generic`, `local_promoter_generic`

Each named promoter must have:
- `id`, `label`, `tier`, `baseNation`, `reputation` (0-100), `capacity` (max fighters), `description`
- `preferredWeightClasses` array
- `venueScale`: `"club"` | `"small_arena"` | `"arena"` | `"stadium"`
- `personality` object: `formality`, `directness`, `pressureStyle`, `flatteryLevel`, `declineReaction`
- `voiceLines` object with keys: `initialOffer`, `offerDeclined`, `fightWon`, `fightLost`, `contractOffer` — each an array of 3+ variants
- `relationshipModifiers`: `resultDelivered`, `fightDeclined`, `fighterUnderperformed`, `exclusiveContractSigned`

Voice line variants use `{fighterName}` and `{weightClass}` as template tokens — engine substitutes real values when delivering messages.

Promoter templates have `capacity` and `reputation` as ranges `{ min, max }` — the engine rolls within these when generating a promoter instance.

Meta must explain: named promoters are real entities in the world from game start. Nation-specific promoters live in nations/[id]/boxing/promoters.json. Procedural promoters are generated from templates when a nation's pro ecosystem advances. The tiered acquisition system during world generation distributes fighters to promoters — world tier gets first pick of top ranked fighters, local tier gets the rest. Capacity limits are enforced — a full promoter cannot sign new fighters until a slot opens.

---

### `nations/latvia/boxing/promoters.json`

Latvia starts with no promoters. They emerge procedurally.

```json
{
  "meta": {
    "version": "1.0.0",
    "description": "Latvian boxing promoters. Latvia has no established pro boxing promoters in 2026 — the domestic pro scene does not yet exist. Promoters are generated procedurally when the pro ecosystem reaches level 1, using the local_promoter_template from universal/promoters.json and the Latvian voice lines defined here. This file defines the communication voice used by any promoter generated within Latvia — dry, direct, understated, no fluff."
  },
  "nationId": "latvia",
  "promoters": [],
  "generatedPromoterVoiceLines": {
    "initialOffer": [
      "We're putting a card together. Your fighter would fit. Here are the numbers.",
      "Heard good things about {fighterName}. We have a slot. Interested?",
      "Simple — we need a fighter at {weightClass}, you have one. Let's talk.",
      "Got a show in {city} next month. {fighterName} ready?"
    ],
    "offerDeclined": [
      "Fine. Let me know if anything changes.",
      "Understood.",
      "Alright. We'll find someone else.",
      "OK."
    ],
    "fightWon": [
      "Good result. We'll be in touch for the next one.",
      "Solid. People noticed. Let's build on it.",
      "Expected nothing less. What's next?",
      "Good night. Let's do it again."
    ],
    "fightLost": [
      "It happens. Come back stronger.",
      "Tough night. We move forward.",
      "Not the result we wanted. Let's see where we go from here.",
      "These things happen in boxing."
    ],
    "contractOffer": [
      "We want to work together properly. Here's what we're proposing.",
      "Contract offer. Nothing complicated. Have a look.",
      "Regular work. Good terms. Here."
    ]
  }
}
```

---

### `universal/pro-fight-offer.json`

Structure definition only — not actual offers. Defines what fields every offer contains and what clause types exist. Engine and UI reference this when constructing and rendering offers.

Include:
- `offerStructure` with `required` and `optional` field lists
- `cardPositions` array: `main_event`, `co_main`, `featured`, `undercard`, `prelim` — each with label, description, `purseMultiplier`
- `clauseTypes` array: `rematch_clause`, `exclusivity_clause`, `weight_clause`, `step_aside`, `purse_split` — each with label, description, `appliesTo`, `details`

Meta must explain: this file is a structural definition not actual fight data. Actual offers are generated by the promoter system and delivered via inbox. The engine reads this when constructing offers to ensure all required fields are present. The UI reads this to know how to render any offer type correctly. Clauses are attached to specific offers — the player sees them clearly before accepting or declining.

---

### Definition Of Done
- [ ] `international/boxing/pro-sanctioning-bodies.json` — 5 bodies including Ring Magazine
- [ ] `international/boxing/pro-title-belts.json` — all belts for all 4 major bodies + Ring Magazine lineal, all 10 weight classes
- [ ] `international/boxing/pro-rankings-structure.json` — ranking rules including acquisition tiers
- [ ] `nations/latvia/boxing/pro-ecosystem.json` — 4 levels, requirements, unlocks, inbox messages
- [ ] `universal/promoters.json` — 4 named promoters with full voice lines, 2 templates, 2 generic voice pools
- [ ] `nations/latvia/boxing/promoters.json` — empty promoters array, Latvian voice lines defined
- [ ] `universal/pro-fight-offer.json` — offer structure, card positions, clause types
- [ ] All files valid JSON, all have meta blocks
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — all 7 files marked `[x]`
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: pro boxing infrastructure data files`

### Notes
- Data only — no TypeScript types, no engine logic, no UI this session
- `pro-title-belts.json` is a large file — all combinations must be present, no shortcuts
- Voice line variants must use `{fighterName}`, `{weightClass}`, `{city}` tokens — engine substitutes at delivery time
- Latvia ecosystem `currentLevel: 0` — starts with nothing, earns everything
- Ring Magazine has no mandatory defence, no title tiers except lineal, prestige 10
- Acquisition tiers in rankings structure are for world generation only — not live gameplay matchmaking
- Nation-specific promoter files follow same pattern — modders adding a new nation include their promoters in the bundle
