# Current Task

## Task: Housekeeping + Physical Stats, Health, Weight Classes + Nation Physical Profile

### What To Build
Housekeeping first, then four data files. Do housekeeping before touching any new files.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/rules/data.md`

---

## Part 1 — Housekeeping

**Move and rename coach voice file:**
- Move `packages/engine/data/nations/latvia/coach-voice.json` → `packages/engine/data/nations/latvia/coach-voice/attributes.json`
- Create the `coach-voice/` subfolder in the process
- Delete the old file at the old path
- Update `docs/structure.md` and `docs/data-registry.md` to reflect the new path

Do not touch the contents of the file — move only.

---

## Part 2 — New Data Files

**`packages/engine/data/universal/weight-classes.json`**

10 weight classes only. No super flyweight, no super bantam, no light flyweight etc.

Classes: Flyweight, Bantamweight, Featherweight, Lightweight, Welterweight, Middleweight, Light Heavyweight, Cruiserweight, Heavyweight, Super Heavyweight.

Each class: `id`, `label`, `limitKg` (null for Heavyweight and Super Heavyweight), `amateurOnly` (true only for Super Heavyweight, omit field entirely for all others).

Meta must explain: these are the only weight classes in the game, Super Heavyweight is amateur competition only, limitKg null means no upper boundary.

---

**`packages/engine/data/universal/physical-stats.json`**

No stance distribution — deferred to when style matchups are built.

Sections:
- `heightProfile` — bands (short/average/tall), probability per band, heightOffsetCm from base, base height by weight class id
- `reachProfile` — bands (short/average/long/freakish), probability, ratio to height, attribute modifiers
- `handSizeProfile` — bands (small/average/large/abnormal), probability, attribute modifiers
- `neckThicknessProfile` — bands (thin/average/thick/abnormal), probability, attribute modifiers on chin and durability
- `boneDensityProfile` — bands (light/average/dense/iron), probability, attribute modifiers
- `bodyProportionsProfile` — bands (short_legs/average/long_legs), probability, attribute modifiers

All attribute modifier values are integers on the 1-20 scale — small adjustments, nothing exceeding +3 or -3 at the extreme end.

Meta must explain: physical stats are never shown raw to the player, they feed silently into attribute modifiers at generation, notable physical traits surface through coach voice, nation files can override band probabilities via physicalProfile block.

---

**`packages/engine/data/universal/health.json`**

Body parts with baseline integrity on 1-20 scale. Generated at birth. This is structural — not fight damage. Fight damage accumulates on top of this baseline separately.

Body parts: `hands`, `chin`, `jaw`, `knees`, `shoulders`, `ribs`, `elbows`

Each body part: `id`, `description`, `generationBands` (typical/fragile/iron with min-max ranges and probabilities), `fragileThreshold` (value at or below which the engine treats this as a chronic risk factor), `attributeModifiers` (which attributes this body part feeds into when generated).

Examples of attribute links:
- hands → power (fragile hands limit power expression), combination_fluency
- chin → chin attribute directly
- knees → footwork, lateral_movement
- shoulders → output_volume, combination_fluency

Meta must explain: 1-20 scale consistent with attributes, fragileThreshold is the line below which a body part creates real simulation risk, fight damage accumulates separately on top of this baseline — this file defines what you were born with.

---

**Update `packages/engine/data/nations/latvia/nation.json`**

Add a `physicalProfile` block. This overrides universal physical-stats.json band probabilities for fighters generated from this nation. Only include bands that differ from universal defaults — omit bands that stay at default.

Latvia is a northern European nation — not physically exceptional in any direction. Modest overrides only. Example: slightly lower probability of abnormal hand size or iron bone density compared to West African nations.

```json
"physicalProfile": {
  "note": "Overrides universal physical-stats.json probabilities for fighters generated from Latvia. Only bands that differ from universal defaults are listed.",
  "handSizeProfile": {
    "abnormal": 0.03
  },
  "boneDensityProfile": {
    "iron": 0.02,
    "dense": 0.12
  },
  "neckThicknessProfile": {
    "abnormal": 0.03
  }
}
```

Meta in nation.json does not need updating — just add the block.

---

**`packages/engine/data/nations/latvia/coach-voice/physical-stats.json`**

Same infrastructure as `coach-voice/attributes.json`. Placeholder lines only — Ginter replaces them manually.

Cover the notable physical profiles that are worth a coach observation. Not every band needs a line — only the ones that are notable enough for a coach to mention.

Cover: hand size (large and abnormal only), neck thickness (thin and abnormal), bone density (dense and iron), reach (long and freakish), body proportions (short_legs and long_legs).

Structure per entry:
```json
{
  "profileId": "handSize_abnormal",
  "coachLine": ["PLACEHOLDER — hand size abnormal", "PLACEHOLDER — hand size abnormal"]
}
```

Array of lines per entry. Minimum 2 placeholders per entry. Engine picks randomly.

Meta must explain: coach only comments on physically notable traits, average profiles produce no coach observation, same replacement workflow as attributes coach voice.

---

### Definition Of Done
- [ ] Old `coach-voice.json` deleted, new path `coach-voice/attributes.json` exists with identical contents
- [ ] `universal/weight-classes.json` — 10 classes, valid JSON
- [ ] `universal/physical-stats.json` — all 6 profiles, no stance, valid JSON
- [ ] `universal/health.json` — 7 body parts, fragile thresholds, attribute links, valid JSON
- [ ] `nations/latvia/nation.json` — physicalProfile block added
- [ ] `nations/latvia/coach-voice/physical-stats.json` — notable profiles only, 2 placeholder lines each
- [ ] All new files have meta blocks
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — all new files marked `[x]`, old coach-voice.json path removed, new path added
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: physical stats, health, weight classes + nation physical profile`

### Notes
- Housekeeping first — move the file before creating anything new
- No stance distribution anywhere in this task
- No TypeScript types this session — data only
- Modifier values are integers, max +3 or -3 at extreme ends
- Nation physicalProfile only lists overrides — do not duplicate universal defaults
