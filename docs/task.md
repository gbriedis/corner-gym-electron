# Current Task

## Task: Gym Data Files + Full Gym Type + Kids Classes + Gym Culture

### What To Build
Three data files, the full Gym TypeScript type replacing the stub, and the GymKidsClass and GymCulture sub-types. No engine logic yet — data and types only.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/rules/data.md`

---

## Part 1 — Data Files

### `packages/engine/data/nations/latvia/gym-starting-states.json`

Starting state templates for gyms generated during world creation. Four templates: `rundown_community`, `established_community`, `competition_gym`, `elite_gym`.

Each template has:
- `id`, `label`, `forPlayerGym` (boolean — only `rundown_community` is true)
- `squareMeters`: `{ min, max }` for total building square meters
- `zones`: each zone with `exists` (boolean) and `condition`: `{ min, max }` (0-100)
  - Zones: `trainingFloor`, `strengthRoom`, `changingRooms`, `reception`, `storage`
  - Elite gym additionally has `videoAnalysisRoom`
- `startingEquipment`: array of `{ typeId, count (number or {min,max}), condition: {min,max} }`
- `finances`: `monthlyRent: {min,max}`, `startingBalance: {min,max}`, `membershipFeeMonthly: {min,max}`
- `lockerCount`: `{ min, max }`
- `reputation`: `local`, `regional`, `national`, `international` — each `{min,max}` or `0`

Template values:
- `rundown_community`: 120-180sqm, worn equipment (condition 15-45), no ring, balance -500 to 1000, rent 200-400, local rep 5-20
- `established_community`: 200-350sqm, decent equipment (40-70), 1 ring, balance 500-3000, rent 400-700, local rep 25-55
- `competition_gym`: 350-600sqm, good equipment (60-85), 1 ring, balance 2000-8000, rent 700-1400, local 60-80, regional 10-45
- `elite_gym`: 600-1200sqm, excellent equipment (75-95), 2 rings, balance 10000-50000, rent 1500-4000, local 80-100, regional 50-80, national 20-60

City distribution — how gyms are assigned templates by city population type:
```json
"cityDistribution": {
  "small_town":  { "rundown_community": 0.60, "established_community": 0.35, "competition_gym": 0.05, "elite_gym": 0.00 },
  "mid_city":    { "rundown_community": 0.30, "established_community": 0.45, "competition_gym": 0.20, "elite_gym": 0.05 },
  "capital":     { "rundown_community": 0.15, "established_community": 0.35, "competition_gym": 0.35, "elite_gym": 0.15 }
}
```

Meta must explain: player gym always uses rundown_community. Rival gyms draw from cityDistribution. Templates define the physical and financial starting point — not the roster, which is populated separately from the city population during world generation.

---

### `packages/engine/data/universal/gym-equipment-types.json`

Every equipment type the engine knows about. Used when generating starting equipment, processing orders, and calculating condition decay.

Fields per equipment type: `id`, `label`, `zone` (which gym zone it belongs to), `squareMetersRequired` (0 for portable items like mitts and ropes), `conditionDecayPerWeek` (float — higher = wears faster), `maintenanceCostMonthly`, `purchaseCost`, `description`, `trainingBenefit` (object mapping attribute ids to `"moderate"` | `"significant"` | `"essential"`), `requiresCoach` (boolean, default false).

Equipment to include:
- `boxing_ring` — 36sqm, decays 0.3/week, costs 3000, essential for ring_generalship and footwork
- `heavy_bag` — 2sqm, decays 0.8/week, costs 150, significant for combination_fluency and output_volume
- `speed_bag` — 1sqm, decays 0.5/week, costs 80, significant for hand_speed
- `double_end_bag` — 2sqm, decays 0.6/week, costs 100, significant for punch_accuracy
- `maize_bag` — 2sqm, decays 0.4/week, costs 120, significant for defensive_skill
- `focus_mitts` — 0sqm, decays 0.4/week, costs 40, significant for technique and punch_selection, requiresCoach true
- `body_shield` — 0sqm, decays 0.3/week, costs 50, significant for body_punch_effectiveness, requiresCoach true
- `skipping_ropes` — 0sqm, decays 1.2/week, costs 8, moderate for stamina and footwork
- `dumbbells_set` — 4sqm, decays 0.1/week, costs 300, moderate for power and durability
- `bench_press` — 6sqm, decays 0.1/week, costs 400, significant for power
- `pull_up_bar` — 1sqm, decays 0.05/week, costs 60, moderate for recovery_rate and durability
- `squat_rack` — 8sqm, decays 0.1/week, costs 600, moderate for footwork and stamina

Meta must explain: condition is 0-100, decays weekly based on usage, reaches 0 if not maintained, maintenance events restore condition. squareMetersRequired of 0 means portable — stored in any zone. The ring's 36sqm requirement means adding a ring to a small gym significantly reduces training capacity.

---

### Update `packages/engine/data/universal/attribute-accumulation.json`

Add one field to `gymQuality` section documenting the ring cap rule explicitly:

```json
"ringAbsenceCapRule": {
  "affectedAttributes": ["ring_generalship", "footwork", "lateral_movement"],
  "capMultiplier": 0.5,
  "note": "If hasRing is false, gains on ring_generalship, footwork, and lateral_movement are capped at 50% of what they would otherwise be. A fighter cannot develop proper ring craft without actually working in a ring."
}
```

---

## Part 2 — Full Gym Type

**Replace stub in `packages/engine/src/types/gym.ts`**

Full replacement — not an extension of the stub. Complete type as follows:

```typescript
// Gym is the physical space, business, community, and reputation.
// Everything in Corner Gym connects to a gym.
// The player's gym is marked isPlayerGym: true.
// Rival gyms run on the same data structure and engine logic.
//
// Capacity rule: maxTrainingCapacity = floor(trainingFloorSquareMeters / 4)
// This is the maximum number of people training simultaneously.
// lockerCount is a separate cap on total membership (people who hold a membership
// regardless of whether they are training at this moment).
// Both constraints are enforced — you can have 100 members but only
// floor(trainingFloor.squareMeters / 4) training at any one time.

export type GymTier =
  | 'community'     // mostly regulars, small competitor percentage
  | 'development'   // balanced, growing reputation
  | 'competition'   // majority competitors, known locally
  | 'elite'         // almost entirely competitors, nationally known
// GymTier is derived by the engine from roster composition and reputation.
// Never set directly — it is always calculated.

export interface GymZone {
  exists: boolean
  condition: number     // 0-100. 0 = unusable. Decays over time without maintenance.
  squareMeters: number
}

export interface GymZones {
  trainingFloor: GymZone
  strengthRoom: GymZone
  changingRooms: GymZone
  reception: GymZone
  storage?: GymZone
  videoAnalysisRoom?: GymZone
}

export interface GymEquipmentItem {
  id: string            // unique instance id — multiple heavy bags each have their own id
  typeId: string        // references gym-equipment-types.json
  condition: number     // 0-100
  purchasedYear: number
  purchasedWeek: number
  lastMaintenanceYear: number | null
  lastMaintenanceWeek: number | null
  inUse: boolean        // false if broken or in storage
}

export interface GymEquipmentOrder {
  // Equipment ordered but not yet arrived — shown in inbox as pending
  id: string
  typeId: string
  quantity: number
  orderedYear: number
  orderedWeek: number
  estimatedArrivalYear: number
  estimatedArrivalWeek: number
  cost: number
}

export type StaffRole =
  | 'head_coach'
  | 'secondary_coach'
  | 'fitness_coach'
  | 'kids_coach'
  | 'maintenance'
  | 'admin'

export interface GymStaffMember {
  personId: string
  role: StaffRole
  startedYear: number
  startedWeek: number
  wageMonthly: number
  isGymMemberFilling: boolean
  // true = a gym member filling the role informally, not a hired professional.
  // Gym members filling roles have a quality ceiling and produce lower training gains.
  // The engine derives their quality from their Person attributes + coaching-relevant traits.
}

export interface GymRevenueRecord {
  year: number
  week: number
  income: number
  outgoings: number
  balance: number
  note: string    // what drove this week's change — surfaces in monthly financial report
}

export interface GymFinances {
  monthlyRent: number
  balance: number
  loanAmount: number
  loanRepaymentMonthly: number
  membershipFeeMonthly: number
  lastUpdatedYear: number
  lastUpdatedWeek: number
  revenueHistory: GymRevenueRecord[]
}

export interface GymQuality {
  // Derived composite quality scores. Never stored statically —
  // recalculated by the engine after any equipment condition change or zone change.
  // Cached here to avoid recalculating every single week unnecessarily.
  trainingFloor: number     // 0-100
  strengthRoom: number      // 0-100
  changingRooms: number     // 0-100
  reception: number         // 0-100
  overall: number           // weighted composite: training 50%, strength 20%, changing 10%, reception 10%, other 10%
  hasRing: boolean          // ring absence hard-caps ring_generalship, footwork, lateral_movement gains
  ringCount: number         // 0, 1, or 2
  maxTrainingCapacity: number  // floor(trainingFloor.squareMeters / 4)
  lastCalculatedYear: number
  lastCalculatedWeek: number
}

export interface GymExpansion {
  // Active building expansion — null when no expansion is underway.
  // Expansions take real time and disrupt training during construction.
  id: string
  description: string
  squareMetersAdded: number
  newZoneId?: string         // if a new zone is being created
  startedYear: number
  startedWeek: number
  completionYear: number
  completionWeek: number
  cost: number
  disruptionWeeksRemaining: number
  // Training quality is reduced during construction — fighters notice the noise and disruption.
}

export interface GymKidsClass {
  // Kids classes are a revenue stream and talent pipeline.
  // They run in off-peak hours and do not compete with main training capacity.
  // The yearly cohort review surfaces any child who showed genuine potential.
  // Those children are pre-seeded in the city talent pool — they may appear
  // at your door when they come of age.
  active: boolean
  instructorPersonId: string | null
  // null = head coach doubles up (lower cohort quality, head coach is stretched)
  // Should ideally be a dedicated kids_coach staff member for best results.
  monthlyFee: number
  currentEnrolment: number
  maxEnrolment: number       // derived from off-peak training floor capacity
  cohortHistory: KidsCohortRecord[]
}

export interface KidsCohortRecord {
  year: number
  enrolmentCount: number
  instructorQuality: number     // quality of instructor that year — affects output
  potentialProspectsCount: number  // how many showed genuine potential
  prospectPersonIds: string[]   // pre-seeded in city talent pool
}

export interface GymCulture {
  // The identity of the gym as felt by everyone who trains here.
  // Derived from the owner, the coach, and the fighters — never set directly.
  // Changes gradually through events: wins, losses, incidents, coaching changes.
  atmosphereScore: number       // 0-100. How the gym feels to be in.
  sparringIntensity: number     // 0-100. How hard people go in sparring.
  // High intensity: tougher fighters, better mental attributes, accelerated health wear.
  // Low intensity: safer, slower development, less grit.
  memberCohesion: number        // 0-100. Family vs broken unit.
  coachingFocus: string | null  // emerges from head coach emphasis — null until established
  reputationTone: string | null
  // What outsiders say about this gym. Emerges after sufficient history.
  // Examples: 'tough', 'technical', 'welcoming', 'elite', 'old school'
  // Derived by engine from atmosphereScore, sparringIntensity, coachingFocus, reputation.
}

export interface GymAccomplishment {
  type: 'amateur_title' | 'pro_title' | 'medal' | 'milestone'
  label: string
  year: number
  fighterId: string
  description: string
}

export interface Gym {
  id: string
  name: string
  cityId: string
  nationId: string
  isPlayerGym: boolean
  foundedYear: number
  foundedWeek: number

  // Physical space
  totalSquareMeters: number
  zones: GymZones
  equipment: GymEquipmentItem[]
  pendingOrders: GymEquipmentOrder[]
  activeExpansion: GymExpansion | null

  // People
  staffMembers: GymStaffMember[]
  memberIds: string[]       // all Person ids who train here (regulars, atmosphere, competitors)
  fighterIds: string[]      // subset of memberIds who are Fighters

  // Business
  finances: GymFinances
  lockerCount: number       // max total membership — separate from training capacity
  kidsClass: GymKidsClass

  // Quality and identity
  quality: GymQuality       // derived, cached, recalculated after changes
  gymTier: GymTier          // derived from roster and reputation — never set directly
  culture: GymCulture
  reputation: GymReputation
  accomplishments: GymAccomplishment[]
}

export interface GymReputation {
  local: number         // 0-100
  regional: number      // 0-100
  national: number      // 0-100
  international: number // 0-100
}
```

---

## Part 3 — Update Loader

**Update `packages/engine/src/data/loader.ts`**

Add to `NationBundle`:
```typescript
gymStartingStates: GymStartingStatesData
```

Add to universal section of `GameData`:
```typescript
gymEquipmentTypes: GymEquipmentTypesData
```

Create minimal types in `src/types/data/gym.ts`:
```typescript
export interface GymStartingStatesData {
  meta: Meta
  templates: GymStartingTemplate[]
  cityDistribution: Record<string, Record<string, number>>
}

export interface GymEquipmentTypesData {
  meta: Meta
  equipment: GymEquipmentTypeDefinition[]
}

export interface GymStartingTemplate {
  id: string
  label: string
  forPlayerGym: boolean
  squareMeters: { min: number; max: number }
  // ... other fields matching the JSON
}

export interface GymEquipmentTypeDefinition {
  id: string
  label: string
  zone: string
  squareMetersRequired: number
  conditionDecayPerWeek: number
  maintenanceCostMonthly: number
  purchaseCost: number
  description: string
  trainingBenefit: Record<string, string>
  requiresCoach?: boolean
}
```

Add both to `src/types/data/index.ts`.

---

### Definition Of Done
- [ ] `gym-starting-states.json` — 4 templates, city distribution, valid JSON, meta block
- [ ] `gym-equipment-types.json` — all 12 equipment types, valid JSON, meta block
- [ ] `attribute-accumulation.json` — ring absence cap rule added
- [ ] `src/types/gym.ts` — full replacement, all interfaces, GymKidsClass and GymCulture included
- [ ] `src/types/data/gym.ts` — GymStartingStatesData and GymEquipmentTypesData
- [ ] Both new data types added to `src/types/data/index.ts`
- [ ] Loader updated — gymStartingStates on NationBundle, gymEquipmentTypes on GameData
- [ ] `pnpm typecheck` clean
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — all new files marked `[x]`, gym.ts marked `[x]` (was `[~]`)
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: gym data files + full gym type`

### Notes
- Data only in Part 1 — no engine logic
- Gym type replaces the stub entirely — not an extension
- maxTrainingCapacity formula: floor(trainingFloor.squareMeters / 4) — document this in the type comment
- Kids class instructor can be null (head coach doubles up) — this is valid, not an error state
- GymTier and reputationTone are never set directly — always derived by engine
- sparringIntensity consequence on health wear is noted in comments — not implemented yet
- GymCulture fields all start at neutral values during world generation — they develop through simulation
