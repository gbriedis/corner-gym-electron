# Current Task

## Task: Universal Attributes + Latvia Coach Voice Infrastructure

### What To Build
Two JSON files. First defines all 22 universal attributes — the engine reference. Second is the Latvia coach voice file — infrastructure for translating attribute bands into coach observations. Placeholder lines throughout. Ginter will replace placeholders with real lines manually.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/rules/data.md`

### Files To Create

---

**`packages/engine/data/universal/attributes.json`**

Meta must explain: attributes exist on every fighter regardless of nation. All use 1-20 scale. Current value and potential ceiling are stored on the fighter record — not here. This file defines what attributes exist, what they mean, and which category they belong to. The engine uses this as its reference for what to track on every fighter.

Each attribute has: `id`, `category`, `scale` (`{ "min": 1, "max": 20 }`), `description`.

Categories and attributes:

**striking:** `power`, `hand_speed`, `punch_accuracy`, `punch_selection`, `combination_fluency`, `output_volume`, `finishing_instinct`, `body_punch_effectiveness`

**defense:** `defensive_skill`, `counter_punching`, `footwork`, `lateral_movement`, `ring_generalship`

**physical:** `stamina`, `chin`, `durability`, `recovery_rate`

**mental:** `ring_iq`, `composure`, `adaptability`, `heart`, `big_fight_experience`

Descriptions must be behavioral — what this attribute looks like in a fight, not a dictionary definition. Example: power is not "how hard a fighter hits" — it is "how much damage a clean punch delivers. Wilder's power means opponents who survive still feel it three rounds later."

---

**`packages/engine/data/nations/latvia/coach-voice.json`**

Meta must explain: this file is the translation layer between engine numbers and what the player sees. The player never sees a raw attribute value. They see a coach observation. The coach is Latvian — dry, blunt, understated, deadpan. Humour comes from specific visual observations delivered without drama. Each attribute has 5 bands. Each band has an array of lines. The engine picks randomly from the array. More lines can be added to any array at any time without code changes — just add a string to the array.

Structure per attribute:
```json
{
  "attributeId": "power",
  "bands": [
    { "range": "1-4",   "label": "nonexistent",  "lines": ["PLACEHOLDER", "PLACEHOLDER"] },
    { "range": "5-8",   "label": "weak",         "lines": ["PLACEHOLDER", "PLACEHOLDER"] },
    { "range": "9-12",  "label": "functional",   "lines": ["PLACEHOLDER", "PLACEHOLDER"] },
    { "range": "13-16", "label": "notable",      "lines": ["PLACEHOLDER", "PLACEHOLDER"] },
    { "range": "17-20", "label": "elite",        "lines": ["PLACEHOLDER", "PLACEHOLDER"] }
  ]
}
```

All 22 attributes must be present. Every band must have exactly 2 placeholder lines minimum. Placeholder text must include the attribute name and band label so Ginter knows exactly what he is replacing — example: `"PLACEHOLDER — power, nonexistent (1-4)"`.

The `label` values are consistent across all attributes:
- 1-4: `"nonexistent"`
- 5-8: `"weak"`
- 9-12: `"functional"`
- 13-16: `"notable"`
- 17-20: `"elite"`

---

### Definition Of Done
- [ ] `universal/attributes.json` — 22 attributes, all categories present, descriptions behavioral not dictionary
- [ ] `nations/latvia/coach-voice.json` — all 22 attributes, all 5 bands, minimum 2 placeholder lines per band, placeholder text identifies attribute and band
- [ ] Both files valid JSON — no trailing commas, no comments inside JSON
- [ ] Both files have meta blocks
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — mark both files `[x]`
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: universal attributes + latvia coach voice infrastructure`

### Notes
- Do not write witty lines — placeholders only, Ginter writes the real lines
- Do not create TypeScript types this session — data only
- Coach voice tone reference: dry, blunt, Latvian, understated. The coach is not trying to be funny. He is just telling you what he sees.
- Infrastructure must support adding more lines to any band by simply adding a string to the array — no other changes needed
