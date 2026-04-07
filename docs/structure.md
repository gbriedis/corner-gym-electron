# Corner Gym — Project Structure

## Purpose
This file is the single source of truth for what exists on disk right now.
Claude Code reads it at session start to know where things live before touching anything.

Rules:
- Only list files that actually exist — never aspirational or planned files
- Planned files live in `docs/data-registry.md` marked as `[ ]`
- Update this file in the same commit where files are added, moved, or deleted
- If a file exists in the repo but not here — add it
- If a file is listed here but was deleted — remove it

---

## Current Tree

```
corner-gym/
├── CLAUDE.md                          # Project laws, stack, commands, how to find work
├── package.json                       # Root — pnpm workspaces + pnpm build allowlist
├── pnpm-workspace.yaml
├── tsconfig.base.json                 # Shared strict TypeScript config
├── .gitignore
├── git-clean-start.sh                 # Wipes git history — run once to clean old repo
│
├── .claude/
│   ├── settings.json                  # Hooks — auto pull, prettier, typecheck gate, stop enforcement
│   ├── lessons.md                     # Mistake log — read every session, add after every correction
│   ├── hooks/
│   │   └── stop.sh                    # Session end script — checks TS, tests, docs, git status
│   ├── rules/
│   │   ├── coding-conventions.md      # Always loaded — TypeScript, React, engine, comment rules
│   │   └── data.md                    # Loaded when touching engine data — the no-hardcoding law
│   ├── skills/
│   │   ├── new-feature/SKILL.md       # Load when building anything new — plan before code
│   │   ├── engine/SKILL.md            # Load when working in packages/engine — advance week, sim tiers
│   │   └── moments/SKILL.md           # Load when writing moment templates — writing rules + schema
│   ├── agents/
│   │   ├── builder/CLAUDE.md          # Builder agent — implements what task.md says
│   │   └── reviewer/CLAUDE.md         # Reviewer agent — checks GDD compliance, hardcoding, tests
│   └── commands/
│       └── review.md                  # /review — invoke reviewer on current session's work
│
├── docs/
│   ├── task.md                        # Current task spec — written by Ginter+Claude before each session
│   ├── structure.md                   # This file
│   └── data-registry.md              # Every planned/partial/done data file and engine module
│
└── packages/
    ├── engine/                        # Pure TypeScript simulation — no UI, no Electron dependencies
    │   ├── package.json               # @corner-gym/engine
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   ├── data/
    │   │   ├── universal/
    │   │   │   ├── soul-traits.json           # All 8 soul trait pairs
    │   │   │   ├── attributes.json            # All 22 universal attributes
    │   │   │   ├── weight-classes.json        # 10 weight classes
    │   │   │   ├── physical-stats.json        # Physical stat band definitions
    │   │   │   ├── health.json                # Body part baseline integrity
    │   │   │   ├── gifts-and-flaws.json       # Gift/flaw definitions for 8 attributes
    │   │   │   ├── development-profiles.json  # 3 profiles — peak age, rise/plateau/decline rates
    │   │   │   ├── game-config-defaults.json  # Default settings for a new game (seed, year, nations, world settings)
    │   │   │   └── difficulties.json          # 4 difficulty presets — multipliers on city modifiers and probabilities
    │   │   └── nations/
    │   │       └── latvia/
    │   │           ├── nation.json
    │   │           ├── cities.json            # 8 Latvian cities with modifiers
    │   │           ├── names.json
    │   │           ├── economic-statuses.json
    │   │           ├── reasons-for-boxing.json
    │   │           └── coach-voice/
    │   │               ├── attributes.json
    │   │               ├── physical-stats.json
    │   │               └── gifts-and-flaws.json
    │   └── src/
    │       ├── index.ts               # Public API — exports types + generateWorld + loadGameData + advanceWeek
    │       ├── types/
    │       │   ├── person.ts          # Person, PhysicalProfile, AttributeValue, HealthValue, GiftFlawAssignment
    │       │   ├── fighter.ts         # Fighter stub
    │       │   ├── gym.ts             # Gym stub
    │       │   ├── location.ts        # Location stub
    │       │   ├── event.ts           # GameEvent stub
    │       │   ├── bout.ts            # Bout stub
    │       │   ├── moment.ts          # Moment stub
    │       │   ├── worldState.ts      # WorldState, GymState, CityState, NationState
    │       │   ├── gameConfig.ts      # GameConfig, DifficultyModifiers, LeagueSettings, WorldSettings
    │       │   └── data/              # TypeScript interfaces for every data file
    │       │       ├── index.ts       # Barrel — re-exports everything
    │       │       ├── meta.ts
    │       │       ├── soulTraits.ts
    │       │       ├── attributes.ts
    │       │       ├── weightClasses.ts
    │       │       ├── physicalStats.ts
    │       │       ├── health.ts
    │       │       ├── giftsAndFlaws.ts
    │       │       ├── nation.ts
    │       │       ├── cities.ts
    │       │       ├── names.ts
    │       │       ├── economicStatuses.ts
    │       │       ├── reasonsForBoxing.ts
    │       │       ├── coachVoice.ts
    │       │       └── developmentProfiles.ts
    │       ├── data/
    │       │   └── loader.ts          # loadGameData() — loads all JSON at startup into typed GameData
    │       ├── utils/
    │       │   └── rng.ts             # Seeded deterministic RNG (mulberry32)
    │       ├── generation/
    │       │   ├── person.ts          # generatePerson — full Person from data + seed
    │       │   ├── person.test.ts     # 37 tests
    │       │   ├── world.ts           # generateWorld — WorldState + Person[] from GameConfig + GameData
    │       │   └── world.test.ts      # 14 tests — determinism, person count, player gym, structure
    │       └── engine/
    │           └── advanceWeek.ts     # Week tick entry point stub
    │
    ├── desktop/                       # Electron main process
    │   ├── package.json               # @corner-gym/desktop — depends on engine + better-sqlite3
    │   ├── tsconfig.json
    │   ├── electron-builder.yml
    │   └── src/
    │       ├── main.ts                # BrowserWindow creation, opens DB, wires IPC
    │       ├── preload.ts             # contextBridge — exposes electronAPI to renderer
    │       ├── ipc.ts                 # IPC handlers: get-new-game-options, generate-and-save, load-save, list-saves, delete-save
    │       └── db.ts                  # SQLite layer — openDb, createSave, loadSave, listSaves, deleteSave
    │
    └── ui/                            # React renderer
        ├── package.json               # @corner-gym/ui — depends on engine + zustand
        ├── tsconfig.json
        ├── vite.config.ts
        ├── index.html
        └── src/
            ├── main.tsx               # React entry
            ├── App.tsx                # Screen router — delegates to current screen component
            ├── electron.d.ts          # Global type declaration for window.electronAPI
            ├── ipc/
            │   └── client.ts          # Typed wrappers — generateAndSave, loadSave, listSaves, deleteSave, getNewGameOptions
            ├── store/
            │   └── gameStore.ts       # Zustand store — worldState, persons, currentScreen, pendingSaveId
            └── screens/
                ├── MainMenu.tsx       # New Game / Load Game / Quit
                ├── NewGame.tsx        # Player name, gym name, nation, city, difficulty, seed form
                ├── Loading.tsx        # Spinner + live progress events during world generation
                ├── LoadGame.tsx       # Save list with load and delete actions
                └── Game.tsx           # Placeholder — proves load flow; shows player name, gym, year/week
```
