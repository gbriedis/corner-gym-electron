# Current Task

## Task: First Data Files — Universal Soul Traits + Latvia Nation Bundle

### What To Build
Create the first six JSON data files. These are the foundation — person generation cannot run without them. No TypeScript types yet. No engine logic yet. Just the data, correctly structured, with meta blocks.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/rules/data.md`

### Files To Create

**`packages/engine/data/universal/soul-traits.json`**
All 8 soul trait pairs. Each trait has: `id`, `opposite`, `revealDifficulty`, `description`.
Reveal difficulty values: `"easy"`, `"medium"`, `"hard"`.
The 8 pairs: brave/craven, calm/panicky, humble/arrogant, patient/impatient, trusting/paranoid, disciplined/reckless, determined/fragile, hungry/content.
Meta must explain: what soul traits are, that they are permanent, that they are never shown as numbers to the player, that reveal difficulty tells the moment system how many qualifying events must occur before a reveal can trigger.

---

**`packages/engine/data/nations/latvia/nation.json`**
Who Latvia is as a nation. What shaped its people. What the nation produces in fighters.
Fields: `id`, `label`, `region`, `boxingCulture` (1-5 scale defined in meta), `description`, `regionalTagsAvailable` (array: `"rural"`, `"urban"`, `"coastal"`), `namePoolReference` (points to `names.json` in same folder).
Meta must explain: what boxing_culture scale means 1-5, that national modifiers come later once the attribute system is built.
No attribute modifiers yet.

---

**`packages/engine/data/nations/latvia/cities.json`**
All playable cities in Latvia for V1.
Each city: `id`, `label`, `regionTag`, `population` (`"small_town"`, `"mid_city"`, `"capital"`), `isStartingOption` (bool), `rentModifier` (float, 1.0 = average), `talentDensity` (float, 1.0 = average), `rivalGymDensity` (float, 1.0 = average), `description`.
Cities: Valmiera, Riga, Daugavpils, Liepāja, Jelgava, Jūrmala, Rēzekne, Jēkabpils.
Meta must explain: all modifiers relative to baseline 1.0, regionTag links to nation.json regionalTagsAvailable.

---

**`packages/engine/data/nations/latvia/names.json`**
Male first names and surnames. Flat pools. No regional splits.
Fields: `nation`, `male.firstNames` (array), `male.surnames` (array).
Minimum 60 first names, minimum 80 surnames. Real Latvian names with correct diacritics.
Meta must explain: male only for V1, engine picks randomly from each array at generation.

---

**`packages/engine/data/nations/latvia/economic-statuses.json`**
Fields per status: `id`, `label`, `weight`, `description`. Weights sum to 1.0.
Statuses: `struggling`, `working_class`, `stable`, `comfortable`.
Meta must explain: weights sum to 1.0, rolled at generation, affects starting context not raw attributes.

---

**`packages/engine/data/nations/latvia/reasons-for-boxing.json`**
Fields per reason: `id`, `label`, `weight`, `description`. Weights sum to 1.0.
Reasons: `outlet`, `prove_something`, `way_out`, `passion`, `fell_into_it`, `family_tradition`, `friend_brought_me`.
Meta must explain: weights sum to 1.0, this is surface-level info the player learns early (ocean rule), it will influence soul trait reveal patterns once that system is built — do not implement that link now, note it in meta only.

---

### Definition Of Done
- [ ] All 6 files valid JSON — no trailing commas, no comments inside JSON blocks
- [ ] Every file has `meta` block with minimum `version` and `description`
- [ ] All weights sum to 1.0 where applicable
- [ ] `regionTag` values in cities.json match `regionalTagsAvailable` in nation.json
- [ ] Latvian names use correct diacritics (ā, č, ē, ģ, ī, ķ, ļ, ņ, š, ū, ž)
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — mark all 6 as `[x]`
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: first data files — soul traits + latvia nation bundle`

### Notes
- Data only this session — no TypeScript types, no engine logic
- No attribute modifiers anywhere — attributes not defined yet
- Do not reference simulation systems that do not exist yet
- Meta descriptions are for Claude Code and future developers — make them useful
