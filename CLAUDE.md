# Corner Gym — Claude Code

## The Laws
1. Nothing hardcoded. All game data lives in JSON under `packages/engine/data/`. Engine reads data, never contains it.
2. TypeScript strict mode. No `any`. Explicit return types always.
3. One task at a time. Finish it fully before starting another.
4. Comment why, not what — on every engine function and simulation decision.
5. After every session: `stop.sh` must pass before committing.

## Stack
- Electron + React + TypeScript + Vite
- Tailwind CSS — no CSS-in-JS, no component libraries
- Zustand — session state
- SQLite via better-sqlite3 — save data
- Pure TypeScript engine — no UI dependencies, no framework

## Commands
```bash
pnpm install        # install dependencies
pnpm dev            # start dev mode
pnpm build          # production build
pnpm test           # run engine tests
pnpm typecheck      # TypeScript check all packages
pnpm lint           # ESLint all packages
```

## How To Find Your Work
Your current task is in `docs/task.md`. Read it. It tells you exactly what to build, which skill to load, and how to verify your work. Do not start coding until you have read it.

## What Exists Right Now
See `docs/structure.md` — reflects only what actually exists on disk.

## Mistakes Already Made
See `.claude/lessons.md` — read before every session.
