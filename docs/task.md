# Current Task

## Task: TypeScript Types for All Data Files

### What To Build
TypeScript interfaces for every data file built so far. No engine logic. No generation functions. Just types that exactly match the JSON schemas. The engine cannot read the data without these.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/rules/data.md`

---

### Files To Create

All files go in `packages/engine/src/types/data/`. This is a new subfolder — create it.

---

**`src/types/data/soulTraits.ts`**
Matches `universal/soul-traits.json`.
```typescript
export type RevealDifficulty = 'easy' | 'medium' | 'hard'

export interface SoulTrait {
  id: string
  opposite: string
  revealDifficulty: RevealDifficulty
  description: string
}

export interface SoulTraitsData {
  meta: Meta
  traits: SoulTrait[]
}
```

---

**`src/types/data/attributes.ts`**
Matches `universal/attributes.json`.
```typescript
export type AttributeCategory = 'striking' | 'defense' | 'physical' | 'mental'

export interface AttributeScale {
  min: number
  max?: number
  generationMax?: number
  absoluteMax?: number
}

export interface Attribute {
  id: string
  category: AttributeCategory
  scale: AttributeScale
  description: string
}

export interface AttributesData {
  meta: Meta
  attributes: Attribute[]
}
```

---

**`src/types/data/weightClasses.ts`**
Matches `universal/weight-classes.json`.

---

**`src/types/data/physicalStats.ts`**
Matches `universal/physical-stats.json`.
Each profile band has probability, modifiers (Partial record of attribute id to number), and any offsets or ratios specific to that profile.

---

**`src/types/data/health.ts`**
Matches `universal/health.json`.
Each body part has id, description, generationBands, fragileThreshold, attributeModifiers.

---

**`src/types/data/giftsAndFlaws.ts`**
Matches `universal/gifts-and-flaws.json`.
Include a HealthNudge interface. discoveryConditions is string array.

---

**`src/types/data/nation.ts`**
Matches `nations/latvia/nation.json` — and any future nation bundle.
PhysicalProfile overrides are Partial — only overridden bands are present.

---

**`src/types/data/cities.ts`**
Matches `nations/latvia/cities.json`.
Population type: `'small_town' | 'mid_city' | 'capital'`
RegionTag type: `'rural' | 'urban' | 'coastal' | 'industrial' | 'high_altitude'`

---

**`src/types/data/names.ts`**
Matches `nations/latvia/names.json`.

---

**`src/types/data/economicStatuses.ts`**
Matches `nations/latvia/economic-statuses.json`.

---

**`src/types/data/reasonsForBoxing.ts`**
Matches `nations/latvia/reasons-for-boxing.json`.

---

**`src/types/data/coachVoice.ts`**
Matches all three coach voice files — attributes, physical stats, gifts and flaws share the same structure.
```typescript
export interface CoachVoiceBand {
  range: string
  label: string
  lines: string[]
}

export interface CoachVoiceAttribute {
  attributeId: string
  bands: CoachVoiceBand[]
}

export interface CoachVoiceProfile {
  profileId: string
  lines: string[]
}

export interface CoachVoiceGiftFlaw {
  id: string
  type: 'gift' | 'flaw'
  lines: string[]
}

export interface CoachVoiceAttributesData {
  meta: Meta
  attributes: CoachVoiceAttribute[]
}

export interface CoachVoicePhysicalData {
  meta: Meta
  profiles: CoachVoiceProfile[]
}

export interface CoachVoiceGiftsFlawsData {
  meta: Meta
  entries: CoachVoiceGiftFlaw[]
}
```

---

**`src/types/data/meta.ts`**
Shared Meta interface used by every data file.
```typescript
export interface Meta {
  version: string
  description: string
  [key: string]: unknown
}
```

Create this first. Every other type file imports from it.

---

**`src/types/data/index.ts`**
Barrel file. Re-exports everything from all type files in this folder.

---

### Rules
- Every interface must exactly match the JSON it represents — no extra fields, no missing fields
- Use string literal union types wherever the JSON has a fixed set of string values
- All fields that are optional in the JSON must be marked optional with `?`
- No `any`. No type assertions.
- Import Meta from `./meta.ts` in every file that uses it
- Add a comment above each interface explaining which JSON file it maps to

---

### Definition Of Done
- [ ] `src/types/data/` folder created with all 13 files
- [ ] `meta.ts` created first, imported correctly everywhere
- [ ] `index.ts` exports everything
- [ ] `pnpm typecheck` passes clean across all packages
- [ ] No `any`, no type assertions
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — all type files marked `[x]`
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: TypeScript types for all data files`

### Notes
- Types only — no generation logic, no engine functions
- If a JSON field's shape is ambiguous, check the actual JSON file before deciding the type
- Partial<> for nation physicalProfile overrides — not all bands will be present
- The compiler is your reviewer — if it passes clean the types are correct
