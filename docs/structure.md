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
    │   │   │   ├── soul-traits.json           # All 8 soul trait pairs — permanent, hidden, never shown as numbers
    │   │   │   ├── attributes.json            # All 22 universal attributes — categories, scale, behavioral descriptions
    │   │   │   ├── weight-classes.json        # 10 weight classes — limits in kg, Super Heavyweight amateur only
    │   │   │   ├── physical-stats.json        # Physical stat band definitions — height, reach, hands, neck, bone, proportions
    │   │   │   ├── health.json                # Body part baseline integrity — 7 parts, fragile thresholds, attribute links
    │   │   │   └── gifts-and-flaws.json       # Gift/flaw definitions for 8 attributes — ceiling boost, probabilities, discovery conditions, health nudges
    │   │   └── nations/
    │   │       └── latvia/
    │   │           ├── nation.json            # Latvia nation definition — boxing culture, region tags, physicalProfile overrides
    │   │           ├── cities.json            # 8 playable Latvian cities with modifiers
    │   │           ├── names.json             # Male Latvian name pool (99 first, 139 surnames)
    │   │           ├── economic-statuses.json # 4 economic backgrounds, weighted generation
    │   │           ├── reasons-for-boxing.json# 7 origin reasons, weighted generation
    │   │           └── coach-voice/
    │   │               ├── attributes.json    # Latvia coach voice — attribute bands to observations, placeholder lines
    │   │               ├── physical-stats.json# Latvia coach voice — notable physical profiles, placeholder lines
    │   │               └── gifts-and-flaws.json# Latvia coach voice — 16 entries, fires on gift/flaw discovery conditions
    │   └── src/
    │       ├── index.ts               # Public API — exports types + advanceWeek
    │       ├── types/
    │       │   ├── person.ts          # Person stub
    │       │   ├── fighter.ts         # Fighter stub
    │       │   ├── gym.ts             # Gym stub
    │       │   ├── location.ts        # Location stub
    │       │   ├── event.ts           # GameEvent stub
    │       │   ├── bout.ts            # Bout stub
    │       │   ├── moment.ts          # Moment stub
    │       │   ├── worldState.ts      # WorldState stub
    │       │   └── data/              # TypeScript interfaces for every data file
    │       │       ├── index.ts       # Barrel — re-exports everything
    │       │       ├── meta.ts        # Shared Meta interface
    │       │       ├── soulTraits.ts  # Matches universal/soul-traits.json
    │       │       ├── attributes.ts  # Matches universal/attributes.json
    │       │       ├── weightClasses.ts # Matches universal/weight-classes.json
    │       │       ├── physicalStats.ts # Matches universal/physical-stats.json
    │       │       ├── health.ts      # Matches universal/health.json
    │       │       ├── giftsAndFlaws.ts # Matches universal/gifts-and-flaws.json
    │       │       ├── nation.ts      # Matches nations/{nation}/nation.json
    │       │       ├── cities.ts      # Matches nations/{nation}/cities.json
    │       │       ├── names.ts       # Matches nations/{nation}/names.json
    │       │       ├── economicStatuses.ts # Matches nations/{nation}/economic-statuses.json
    │       │       ├── reasonsForBoxing.ts # Matches nations/{nation}/reasons-for-boxing.json
    │       │       └── coachVoice.ts  # Matches nations/{nation}/coach-voice/*.json
    │       ├── data/
    │       │   └── loader.ts          # Loads all JSON at startup — returns typed GameData object
    │       ├── utils/
    │       │   └── rng.ts             # Seeded deterministic RNG (mulberry32) — no Math.random()
    │       ├── generation/
    │       │   ├── person.ts          # generatePerson — full person from data + seed
    │       │   └── person.test.ts     # 27 tests — fields, soul traits, attributes, health, determinism
    │       └── engine/
    │           └── advanceWeek.ts     # Week tick entry point stub
    │
    ├── desktop/                       # Electron main process
    │   ├── package.json               # @corner-gym/desktop
    │   ├── tsconfig.json              # Extends base, CommonJS output for Electron
    │   ├── electron-builder.yml       # Builds to out/, app name Corner Gym
    │   └── src/
    │       ├── main.ts                # BrowserWindow creation, loads UI dev server or dist
    │       ├── preload.ts             # Preload stub — contextIsolation enabled
    │       └── ipc.ts                 # IPC handlers stub — wire engine calls here
    │
    └── ui/                            # React renderer
        ├── package.json               # @corner-gym/ui
        ├── tsconfig.json              # Extends base, bundler resolution, react-jsx
        ├── vite.config.ts             # React plugin, outputs to dist/
        ├── index.html                 # Vite entry — Tailwind CDN
        └── src/
            ├── main.tsx               # React entry — mounts App into #root
            ├── App.tsx                # Full-screen dark div with "Corner Gym" centered
            └── ipc/
                └── client.ts          # IPC client stub — calls to main process go here
```
