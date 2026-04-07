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
    │       │   └── worldState.ts      # WorldState stub
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
