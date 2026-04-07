# Current Task

## Task: Scaffold Monorepo — Get The Project Standing

### What To Build
Wire up the full monorepo so the project breathes. No game logic. No data. Just the skeleton standing.

When this task is done:
- `pnpm install` works cleanly across all packages
- `pnpm typecheck` passes with zero errors
- `pnpm dev` opens an Electron window showing "Corner Gym" in white text on a dark background
- Nothing else — no features, no placeholder screens, no lorem ipsum

### Skill To Load
`.claude/skills/new-feature/SKILL.md`

### Packages To Create
Two new packages alongside the existing `packages/engine`:

**`packages/desktop`** — Electron main process
- `package.json` — name `@corner-gym/desktop`, depends on `@corner-gym/engine`
- `tsconfig.json` — extends `../../tsconfig.base.json`
- `electron-builder.yml` — basic config, app name Corner Gym, output to `out/`
- `src/main.ts` — Electron entry point. Creates BrowserWindow, loads the UI. Nothing else.
- `src/preload.ts` — empty preload stub, contextIsolation enabled
- `src/ipc.ts` — empty IPC stub. Comment: IPC handlers go here as engine features are built.

**`packages/ui`** — React renderer
- `package.json` — name `@corner-gym/ui`, depends on `@corner-gym/engine`
- `tsconfig.json` — extends `../../tsconfig.base.json`
- `vite.config.ts` — React plugin, outputs to `dist/`
- `index.html` — Vite entry
- `src/main.tsx` — React entry, mounts App
- `src/App.tsx` — renders a single full-screen dark div with "Corner Gym" centered in white text. Tailwind only.
- `src/ipc/client.ts` — empty IPC client stub. Comment: calls to main process go here.

### Dependencies To Install
**desktop:** `electron`, `electron-builder`, `@corner-gym/engine`
**ui:** `react`, `react-dom`, `@types/react`, `@types/react-dom`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@corner-gym/engine`

### Definition Of Done
- [ ] `pnpm install` — clean, no peer dep errors
- [ ] `pnpm typecheck` — zero errors across all three packages
- [ ] `pnpm dev` — Electron window opens, shows "Corner Gym" on dark background
- [ ] No hardcoded game values anywhere (there shouldn't be any yet)
- [ ] `docs/structure.md` updated with all new files
- [ ] `docs/data-registry.md` — no changes needed this task
- [ ] `bash .claude/hooks/stop.sh` — all green
- [ ] Committed with message: `feat: scaffold monorepo — electron + react standing`

### Notes
- Tailwind via CDN in index.html is fine for now — no PostCSS config needed yet
- The Electron window should have `nodeIntegration: false` and `contextIsolation: true`
- Do not add any game screens, routing, or state management yet — that is a future task
- If anything is unclear, stop and flag it — do not guess
