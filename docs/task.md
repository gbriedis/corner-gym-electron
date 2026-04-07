# Current Task

## Task: Universal Gifts and Flaws + Coach Voice

### What To Build
Two files. The gifts and flaws data file with discovery conditions, and the Latvia coach voice file for gifts and flaws. This completes the fighter data layer.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/rules/data.md`

---

### Files To Create

**`packages/engine/data/universal/gifts-and-flaws.json`**

Meta must explain:
- Gifts push attribute ceiling from 18 to 20. Without a gift no attribute can exceed 18 at generation.
- Flaws weight generation toward low rolls. Floor stays at 1 but probability of rolling low increases significantly.
- Gifts and flaws apply to attributes only — health is a separate system.
- Some entries have a healthNudge — when rolled, shifts the corresponding health body part probability toward iron (gift) or fragile (flaw). Probabilistic influence only, not a direct override.
- Most fighters generate zero gifts and zero flaws. One is uncommon. Two is rare. Three is almost never.
- discoveryConditions define what events must occur before the player can see this gift or flaw. The moment system evaluates these conditions. When met, it fires the corresponding coach voice line from coach-voice/gifts-and-flaws.json.
- Gift and flaw probabilities are independent rolls per attribute.

**Gift-eligible attributes:**
`power`, `hand_speed`, `chin`, `durability`, `stamina`, `recovery_rate`, `lateral_movement`, `footwork`

**Structure per entry:**
```json
{
  "id": "power_gift",
  "type": "gift",
  "appliesTo": "power",
  "attributeCeilingBoost": 2,
  "giftProbability": 0.04,
  "flawProbability": 0.06,
  "discoveryConditions": ["first_fight", "heavy_sparring"],
  "healthNudge": null,
  "description": "Disproportionate hitting force relative to size and technical output. Wilder. Hearns. Foreman."
}
```

**Entries with health nudge:**
```json
{
  "id": "chin_gift",
  "type": "gift",
  "appliesTo": "chin",
  "attributeCeilingBoost": 2,
  "giftProbability": 0.05,
  "flawProbability": 0.05,
  "discoveryConditions": ["first_fight", "dropped_in_sparring"],
  "healthNudge": {
    "bodyPart": "chin",
    "giftShift": "toward_iron",
    "flawShift": "toward_fragile"
  },
  "description": "Structural ability to absorb punishment. Fury getting up twice from Wilder. Not courage — architecture."
}
```

Health nudge attributes:
- `chin` → body parts `chin` and `jaw`
- `durability` → body parts `ribs` and `shoulders`
- `recovery_rate` → body part `hands`
- `stamina` → no health nudge (cardiovascular, not structural)

discoveryConditions values to use across entries:
`"first_fight"`, `"heavy_sparring"`, `"dropped_in_sparring"`, `"sustained_body_work"`, `"championship_rounds"`, `"back_to_back_fights"`

Use judgment — power gift reveals in first fight or heavy sparring. Stamina flaw reveals in championship rounds or back to back fights. Chin flaw reveals when dropped in sparring or first fight.

All 8 eligible attributes must be present. attributeCeilingBoost is always 2.

---

**`packages/engine/data/nations/latvia/coach-voice/gifts-and-flaws.json`**

Same infrastructure as other coach voice files. Placeholder lines only — Ginter replaces manually.

Coach voice fires when the discovery condition for a gift or flaw is met. The moment system pulls a random line from this file and surfaces it to the player as a coach observation.

Cover all 8 gifts and all 8 flaws — 16 entries total.

Structure per entry:
```json
{
  "id": "power_gift",
  "type": "gift",
  "lines": [
    "PLACEHOLDER — power gift discovery",
    "PLACEHOLDER — power gift discovery"
  ]
}
```

Minimum 2 placeholder lines per entry. Placeholder text must identify what it is so Ginter knows what to replace it with.

Tone reminder: dry, blunt, Latvian coach. Deadpan understatement. The coach is not excited. He is just telling you what he saw.

Meta must explain: these lines fire when a gift or flaw discovery condition is met, engine picks randomly from the lines array, add more lines to any array without code changes.

---

### Definition Of Done
- [ ] `universal/gifts-and-flaws.json` — all 8 eligible attributes, discoveryConditions on every entry, healthNudge on chin/durability/recovery_rate
- [ ] `nations/latvia/coach-voice/gifts-and-flaws.json` — 16 entries, minimum 2 placeholder lines each
- [ ] Both files valid JSON
- [ ] Both files have meta blocks
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — both files marked `[x]`
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: universal gifts and flaws + coach voice`

### Notes
- Data only — no TypeScript, no engine logic
- discoveryConditions are consumed by the moment system — do not implement that logic now, just define the conditions in the data
- Coach voice fires on discovery — that wiring happens in the moment system, not here
- Placeholder text must be descriptive enough that Ginter knows exactly what line to write
