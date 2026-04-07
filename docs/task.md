# Current Task

## Task: Game Config, World Generation, SQLite Layer, New Game + Load UI

### What To Build
The full new game flow end to end. Config → generate world → save to SQLite → load from SQLite. Multiple saves. React UI for main menu, new game config, load screen. No dead code, no future promises — everything grounded in existing data.

Do in this order:
1. Data files
2. Types
3. SQLite schema
4. World generation engine
5. IPC bridge
6. UI screens

### Skill To Load
`.claude/skills/engine/SKILL.md`
`.claude/skills/new-feature/SKILL.md`

---

## Part 1 — Data Files

**`packages/engine/data/universal/game-config-defaults.json`**

Meta must explain: default settings for a new game. All values here are the baseline a normal difficulty game uses. Difficulty presets in difficulties.json apply multipliers on top of these defaults.

```json
{
  "seed": null,
  "startYear": 2026,
  "renderedNations": ["latvia"],
  "leagues": {
    "amateur": true,
    "pro": true
  },
  "worldSettings": {
    "populationPerCity": 200,
    "gymsPerCity": {
      "small_town": 1,
      "mid_city": 3,
      "capital": 6
    }
  }
}
```

Seed null means auto-generate a random seed at game start.

---

**`packages/engine/data/universal/difficulties.json`**

Meta must explain: difficulty presets apply multipliers to city-level modifiers and generation probabilities. All values are multipliers against the base value — 1.0 means unchanged. Only fields that differ from baseline are listed per difficulty. Engine merges difficulty modifiers with defaults at world generation time.

Four presets: `easy`, `normal`, `hard`, `extreme`.

Modifiers available (all grounded in existing data — no new fields):
- `rentModifier` — multiplier on city rentModifier values
- `talentDensity` — multiplier on city talentDensity values  
- `rivalGymDensity` — multiplier on city rivalGymDensity values
- `giftProbabilityMultiplier` — multiplier on all gift probabilities in gifts-and-flaws.json
- `flawProbabilityMultiplier` — multiplier on all flaw probabilities
- `economicStatusWeightShift` — shifts population distribution toward struggling (>1.0) or comfortable (<1.0)
- `developmentProfileShift` — shifts toward late_bloomer (harder, talent harder to spot) or early_bloomer (easier)

Easy: more talent, cheaper rent, fewer rivals, more gifts, more comfortable backgrounds.
Normal: all multipliers at 1.0.
Hard: less talent, higher rent, more rivals, fewer gifts, more struggling backgrounds.
Extreme: punishing on all axes.

---

## Part 2 — Types

**`packages/engine/src/types/gameConfig.ts`**

```typescript
// GameConfig is passed to generateWorld() and drives all world generation decisions.
// It is never assumed or defaulted inside the engine — the caller always provides it explicitly.
// This keeps engine functions pure and testable without UI or default assumptions.

export interface LeagueSettings {
  amateur: boolean
  pro: boolean
}

export interface WorldSettings {
  populationPerCity: number
  gymsPerCity: Record<string, number>  // keyed by population type
}

export interface DifficultyModifiers {
  rentModifier: number
  talentDensity: number
  rivalGymDensity: number
  giftProbabilityMultiplier: number
  flawProbabilityMultiplier: number
  economicStatusWeightShift: number
  developmentProfileShift: number
}

export interface GameConfig {
  seed: number
  startYear: number
  playerName: string
  gymName: string
  playerCityId: string
  playerNationId: string
  renderedNations: string[]
  difficulty: 'easy' | 'normal' | 'hard' | 'extreme'
  difficultyModifiers: DifficultyModifiers
  leagues: LeagueSettings
  worldSettings: WorldSettings
}
```

---

**`packages/engine/src/types/worldState.ts`**

```typescript
// WorldState is the complete generated world. It is serialised to SQLite after generation
// and deserialised when loading a save. All simulation functions receive WorldState.

export interface GymState {
  id: string
  name: string
  cityId: string
  nationId: string
  isPlayerGym: boolean
  reputation: number        // 0-100
  personIds: string[]       // references persons in the save
}

export interface CityState {
  cityId: string
  nationId: string
  gymIds: string[]
}

export interface NationState {
  nationId: string
  cityIds: string[]
}

export interface WorldState {
  saveId: string
  seed: number
  currentYear: number
  currentWeek: number
  playerName: string
  gymName: string
  playerGymId: string
  playerCityId: string
  playerNationId: string
  nations: Record<string, NationState>
  cities: Record<string, CityState>
  gyms: Record<string, GymState>
  // persons stored separately in SQLite persons table — not embedded here
}
```

---

## Part 3 — SQLite Schema

**Update `packages/desktop/src/db.ts`**

Normalised tables. Never store WorldState as a blob.

```sql
-- saves: one row per save slot
CREATE TABLE saves (
  id TEXT PRIMARY KEY,
  saveName TEXT NOT NULL,
  playerName TEXT NOT NULL,
  gymName TEXT NOT NULL,
  cityId TEXT NOT NULL,
  nationId TEXT NOT NULL,
  currentYear INTEGER NOT NULL,
  currentWeek INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  difficulty TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  lastPlayedAt TEXT NOT NULL
);

-- world_state: serialised WorldState json per save
-- WorldState itself has no persons — persons are in their own table
CREATE TABLE world_state (
  saveId TEXT PRIMARY KEY,
  data TEXT NOT NULL,   -- JSON serialised WorldState
  FOREIGN KEY (saveId) REFERENCES saves(id)
);

-- persons: one row per generated person per save
CREATE TABLE persons (
  id TEXT NOT NULL,
  saveId TEXT NOT NULL,
  data TEXT NOT NULL,   -- JSON serialised Person
  cityId TEXT NOT NULL,
  gymId TEXT,           -- null if not in a gym
  nationId TEXT NOT NULL,
  age INTEGER NOT NULL,
  PRIMARY KEY (id, saveId),
  FOREIGN KEY (saveId) REFERENCES saves(id)
);
```

Export typed functions:
```typescript
export function createSave(db: Database, worldState: WorldState, persons: Person[], config: GameConfig): string
export function loadSave(db: Database, saveId: string): { worldState: WorldState; persons: Person[] }
export function listSaves(db: Database): SaveSummary[]
export function deleteSave(db: Database, saveId: string): void
```

`SaveSummary` matches the saves table columns — enough to display a load screen entry.

Comment why persons are in their own table rather than embedded in world_state JSON — querying persons by cityId, gymId, age without deserialising the entire world state blob.

---

## Part 4 — World Generation

**`packages/engine/src/generation/world.ts`**

```typescript
// generateWorld produces a complete WorldState from a GameConfig.
// Generation order:
// 1. Initialise RNG from config.seed
// 2. For each rendered nation — generate cities
// 3. For each city — generate population (Person[])
// 4. For each city — generate gyms, distribute population across gyms
// 5. Mark player gym based on config.playerCityId
// 6. Return WorldState + all generated persons

export function generateWorld(config: GameConfig, data: GameData): {
  worldState: WorldState
  persons: Person[]
}
```

Difficulty modifiers apply at generation:
- `talentDensity` multiplier scales `populationPerCity` for each city
- `giftProbabilityMultiplier` passed into generatePerson as a config override
- `economicStatusWeightShift` adjusts economic status weights before rolling
- `rentModifier` and `rivalGymDensity` stored on GymState for later use

Player gym gets `isPlayerGym: true`. Name comes from `config.gymName`.

Comment every generation step explaining why that order.

---

## Part 5 — IPC Bridge

**Update `packages/desktop/src/ipc.ts`**

Three handlers:

```typescript
// ipc: generate-and-save
// Receives GameConfig from UI, generates world, saves to SQLite, returns saveId.
// Runs synchronously — UI shows spinner with progress messages during this call.
ipcMain.handle('generate-and-save', async (_, config: GameConfig) => {
  // 1. loadGameData()
  // 2. generateWorld(config, data) — emit progress events during generation
  // 3. createSave(db, worldState, persons, config)
  // 4. return saveId
})

// ipc: load-save
// Receives saveId, returns WorldState + persons from SQLite.
ipcMain.handle('load-save', async (_, saveId: string) => {
  return loadSave(db, saveId)
})

// ipc: list-saves
// Returns all SaveSummary entries for the load screen.
ipcMain.handle('list-saves', async () => {
  return listSaves(db)
})

// ipc: delete-save
ipcMain.handle('delete-save', async (_, saveId: string) => {
  deleteSave(db, saveId)
})
```

Progress events during generation — emit via `webContents.send`:
- `generation-progress` with `{ step: string, detail: string, elapsedMs: number }`

Steps to emit: "Loading game data", "Generating population for [city]", "Generating gyms", "Saving to database", "Done"

---

## Part 6 — UI Screens

All screens use Tailwind only. Dark background throughout. No component libraries.

---

**`packages/ui/src/screens/MainMenu.tsx`**

Three buttons: New Game, Load Game, Quit.
Dark, clean, minimal. Gym name "Corner Gym" centred. No logo needed.

---

**`packages/ui/src/screens/NewGame.tsx`**

Form fields:
- Player name (text input)
- Gym name (text input)
- Nation (dropdown — rendered nations from config defaults, for now just Latvia)
- City (dropdown — cities where `isStartingOption: true`, filtered by selected nation)
- Difficulty (four buttons: Easy / Normal / Hard / Extreme — selected state highlighted)
- Seed (text input, pre-filled with random number, editable)

Start Game button — disabled until all fields filled.

On submit: calls `generate-and-save` IPC with built GameConfig. Transitions to Loading screen.

---

**`packages/ui/src/screens/Loading.tsx`**

Shows spinner. Listens for `generation-progress` IPC events. Displays current step and detail. Shows elapsed time. On completion transitions to Game screen.

---

**`packages/ui/src/screens/LoadGame.tsx`**

Calls `list-saves` on mount. Shows list of saves — each card shows: save name, player name, gym name, city, difficulty, current year/week, last played date. Delete button per save with confirmation. Load button per save. Empty state if no saves exist.

---

**`packages/ui/src/screens/Game.tsx`**

Placeholder only. Shows: "Welcome, [playerName]. [gymName] is yours." and current year/week. This proves the load flow works. No game logic yet.

---

**`packages/ui/src/store/gameStore.ts`**

Zustand store. Holds current session state.

```typescript
interface GameStore {
  worldState: WorldState | null
  persons: Person[]
  currentScreen: 'mainMenu' | 'newGame' | 'loadGame' | 'loading' | 'game'
  setScreen: (screen: string) => void
  loadWorld: (worldState: WorldState, persons: Person[]) => void
  clearWorld: () => void
}
```

---

**`packages/ui/src/ipc/client.ts`**

Typed wrappers around IPC calls:

```typescript
export async function generateAndSave(config: GameConfig): Promise<string>
export async function loadSave(saveId: string): Promise<{ worldState: WorldState; persons: Person[] }>
export async function listSaves(): Promise<SaveSummary[]>
export async function deleteSave(saveId: string): Promise<void>
export function onGenerationProgress(callback: (data: ProgressEvent) => void): () => void
```

---

### Definition Of Done
- [ ] `game-config-defaults.json` and `difficulties.json` created
- [ ] `GameConfig` and `WorldState` types created
- [ ] SQLite schema created with normalised tables
- [ ] `generateWorld()` produces valid WorldState + Person array
- [ ] IPC handlers wired — generate-and-save, load-save, list-saves, delete-save
- [ ] Progress events emitted during world generation
- [ ] Main menu renders
- [ ] New game form — all fields, validation, submits to IPC
- [ ] Loading screen — shows progress events, elapsed time
- [ ] Load game screen — lists saves, load and delete work
- [ ] Game screen placeholder — shows player name, gym name, year/week
- [ ] `pnpm dev` — full flow works: new game → config → loading → game screen
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing — world generation tests written
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: game config, world gen, sqlite, new game + load UI`

### Notes
- No dead code — Game.tsx is a placeholder but it proves the flow, not a promise
- Difficulty modifiers only touch fields that exist in current data — no future fields
- Progress events make the spinner feel alive — emit one per city generated
- SQLite persons table has cityId and gymId columns for future querying — comment why
- Never store WorldState as a blob — normalised tables only
- generateWorld tests: same seed + config = same world, person count matches config, player gym marked correctly
