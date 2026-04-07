# Current Task

## Task: Development Profiles + Dynamic Loader Refactor

### What To Build
Two things in sequence. Do them in this order — loader first, development profiles second.

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## Part 1 — Dynamic Loader Refactor

The current `loader.ts` has hardcoded nation blocks. Adding a new nation requires touching engine code. This must be fixed before the nation count grows.

### Goal
The loader dynamically scans `data/nations/` and loads every nation bundle it finds. Adding a nation bundle becomes: drop the folder in, restart. No engine code changes required. This is the foundation for Steam mod support.

### How It Works
Each nation folder must contain these standard files to be considered valid:
- `nation.json`
- `cities.json`
- `names.json`
- `economic-statuses.json`
- `reasons-for-boxing.json`
- `coach-voice/attributes.json`
- `coach-voice/physical-stats.json`
- `coach-voice/gifts-and-flaws.json`

The loader scans `data/nations/`, finds every subfolder, attempts to load the standard files from each. If any standard file is missing from a nation folder — throw a descriptive error naming the nation and the missing file. Never silently skip a broken bundle.

### Changes To `src/data/loader.ts`

Replace the hardcoded `nations.latvia` block with a dynamic structure:

```typescript
// NationBundle holds all data for a single loaded nation.
// The structure is identical regardless of which nation it is —
// any nation folder with the standard files becomes a valid bundle.
export interface NationBundle {
  nation: NationData
  cities: CitiesData
  names: NamesData
  economicStatuses: EconomicStatusesData
  reasonsForBoxing: ReasonsForBoxingData
  coachVoice: {
    attributes: CoachVoiceAttributesData
    physicalStats: CoachVoicePhysicalData
    giftsAndFlaws: CoachVoiceGiftsFlawsData
  }
}

// GameData.nations is now a record keyed by nation id (folder name).
// Engine code accesses nations as: data.nations['latvia']
// This works for any nation — no hardcoded keys anywhere.
export interface GameData {
  soulTraits: SoulTraitsData
  attributes: AttributesData
  weightClasses: WeightClassesData
  physicalStats: PhysicalStatsData
  health: HealthData
  giftsAndFlaws: GiftsAndFlawsData
  developmentProfiles: DevelopmentProfilesData  // new — added this task
  nations: Record<string, NationBundle>
}
```

Use `readdirSync` to scan the nations folder. Load each subfolder as a NationBundle. The nation id is the folder name — must match the `id` field in `nation.json`. Throw if they don't match.

Comment why dynamic loading was chosen over hardcoded blocks, and why a mismatch between folder name and nation id is a hard error.

### Update All Call Sites
`generatePerson()` currently accesses `data.nations.latvia` directly — update it to `data.nations[nationId]`. This makes generation nation-agnostic. Add a check: if the nation bundle doesn't exist in the loaded data, throw a descriptive error.

### Tests
Update existing loader tests to work with the dynamic structure. Add a test that verifies: if a nation folder is missing a required file, loadGameData throws with a message naming the nation and the missing file.

---

## Part 2 — Development Profiles

### New Data File
**`packages/engine/data/universal/development-profiles.json`**

Meta must explain: development profile is assigned at generation and never changes. It defines the shape of a person's attribute curve over their career — when they peak, how fast they rise, how long they plateau, how fast they decline. The engine uses this profile alongside age to calculate the ageFactor at any point in time. The hardcoded ageFactor function in generation/person.ts is replaced by a curve lookup using this data.

Three profiles:

```json
{
  "profiles": [
    {
      "id": "early_bloomer",
      "label": "Early Bloomer",
      "probability": 0.20,
      "peakAgeRange": { "min": 22, "max": 25 },
      "riseRate": 0.08,
      "plateauDuration": 3,
      "declineRate": 0.04,
      "description": "Develops faster than peers, peaks younger, fades sooner. High output early career. Risk of early decline."
    },
    {
      "id": "normal",
      "label": "Normal",
      "probability": 0.60,
      "peakAgeRange": { "min": 26, "max": 30 },
      "riseRate": 0.05,
      "plateauDuration": 4,
      "declineRate": 0.025,
      "description": "Standard development curve. The majority of fighters."
    },
    {
      "id": "late_bloomer",
      "label": "Late Bloomer",
      "probability": 0.20,
      "peakAgeRange": { "min": 29, "max": 34 },
      "riseRate": 0.03,
      "plateauDuration": 5,
      "declineRate": 0.015,
      "description": "Slow to develop. Peaks later, plateaus longer, declines more gradually. Long career ceiling."
    }
  ]
}
```

`riseRate` — how much ageFactor increases per year before peak.
`plateauDuration` — how many years the fighter stays near peak (ageFactor > 0.95) after reaching it.
`declineRate` — how much ageFactor decreases per year after plateau ends.
`peakAgeRange` — rolled at generation to get this person's specific peak age.

### New Type File
**`src/types/data/developmentProfiles.ts`**

Interface matching the JSON. Export `DevelopmentProfile` and `DevelopmentProfilesData`. Add to `src/types/data/index.ts`.

### Update `src/types/person.ts`
Add two fields:
```typescript
developmentProfileId: string   // references development-profiles.json id
peakAge: number                // rolled from profile's peakAgeRange at generation
```

### Update `src/generation/person.ts`

**Replace the hardcoded `ageFactor()` function** with a data-driven calculation:

```typescript
// calculateAgeFactor derives the current/potential ratio from the person's
// development profile and their specific peak age.
// Before peak: linear rise from a base of 0.55 at age 14, using profile riseRate.
// At/near peak: plateau at 0.98 for plateauDuration years.
// After plateau: linear decline using profile declineRate, floored at 0.40.
// Using data-driven rates rather than hardcoded values means development curves
// can be tuned in JSON without touching engine code.
function calculateAgeFactor(age: number, peakAge: number, profile: DevelopmentProfile): number
```

Add development profile roll to Step 1 (Identity):
- Roll profile from weighted probabilities
- Roll peak age from `peakAgeRange` using RNG
- Store both on the person

### Update Tests
- Add test: early bloomer at age 23 has higher ageFactor than late bloomer at same age
- Add test: late bloomer at age 32 has higher ageFactor than early bloomer at same age
- Add test: same profile + same seed = same peakAge every time
- Add test: ageFactor never exceeds 1.0, never goes below 0.40
- Update existing age factor tests to use the new function signature

---

### Definition Of Done
- [ ] `loader.ts` — dynamic nation scanning, no hardcoded nation keys
- [ ] `generatePerson()` — accesses nations via `data.nations[nationId]`
- [ ] `universal/development-profiles.json` — 3 profiles, probabilities sum to 1.0
- [ ] `src/types/data/developmentProfiles.ts` — created, exported from index
- [ ] `src/types/person.ts` — `developmentProfileId` and `peakAge` added
- [ ] `src/generation/person.ts` — hardcoded `ageFactor()` replaced with data-driven version
- [ ] All existing tests still passing
- [ ] New tests written and passing
- [ ] `pnpm typecheck` clean
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — `development-profiles.json` marked `[x]`
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: dynamic loader + development profiles`

### Notes
- Loader refactor first — generation changes depend on the updated GameData structure
- The hardcoded ageFactor function must be fully deleted — no dead code left behind
- Nation id must equal folder name — enforce this with a thrown error, not a warning
- riseRate, plateauDuration, declineRate are tuning values — they will change as the game is balanced. They must live in JSON, never in code.
