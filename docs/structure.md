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
    │   │   ├── nations/
    │   │   │   └── latvia/
    │   │   │       ├── nation.json
    │   │   │       ├── cities.json            # 8 Latvian cities with modifiers
    │   │   │       ├── names.json
    │   │   │       ├── economic-statuses.json
    │   │   │       ├── reasons-for-boxing.json
    │   │   │       ├── coach-voice/
    │   │   │       │   ├── attributes.json
    │   │   │       │   ├── physical-stats.json
    │   │   │       │   └── gifts-and-flaws.json
    │   │   │       └── boxing/
    │   │   │           ├── sanctioning-bodies.json  # LBF — national body, affiliates to EUBC
    │   │   │           ├── amateur-circuit.json     # 3 domestic circuit levels
    │   │   │           ├── event-templates.json     # 3 event templates with venue pools
    │   │   │           ├── venues.json              # 16 Latvian venues — club gyms, regional halls, national arenas
    │   │   │           └── lbf-rules.json           # LBF bout rules — 3 circuit levels × 3 age categories
    │   │   └── international/
    │   │       └── boxing/
    │   │           ├── sanctioning-bodies.json  # EUBC (continental) + IBA (international)
    │   │           ├── circuits.json            # Baltic, European, World, Olympics circuit levels
    │   │           ├── event-templates.json     # 4 international event templates with venue pools
    │   │           ├── venues.json              # 13 non-Latvian venues — Baltic, European, World/Olympic
    │   │       ├── eubc-rules.json          # EUBC rules — Baltic + European championship levels
    │   │       └── iba-rules.json           # IBA rules — World Championship + Olympics
    │   └── src/
    │       ├── index.ts               # Public API — exports types + generateWorld + loadGameData + advanceWeek
    │       ├── types/
    │       │   ├── competition.ts     # Bout, Card, TournamentBracket, MultiDayEvent, RulesData — structural containers, no simulation logic
    │       │   ├── index.ts           # Barrel — re-exports all competition types
    │       │   ├── person.ts          # Person, PhysicalProfile, AttributeValue, HealthValue, GiftFlawAssignment
    │       │   ├── fighter.ts         # Fighter stub
    │       │   ├── gym.ts             # Gym stub
    │       │   ├── location.ts        # Location stub
    │       │   ├── event.ts           # GameEvent stub
    │       │   ├── bout.ts            # Bout stub
    │       │   ├── moment.ts          # Moment stub
    │       │   ├── calendar.ts        # CalendarEvent, CalendarData, EventStatus
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
    │       │       ├── developmentProfiles.ts
    │       │       └── boxing.ts      # All boxing data types — sanctioning bodies, circuits, templates, venues
    │       ├── data/
    │       │   └── loader.ts          # loadGameData() — GameData + NationBoxingData + InternationalData
    │       ├── utils/
    │       │   └── rng.ts             # Seeded deterministic RNG (mulberry32)
    │       ├── generation/
    │       │   ├── person.ts          # generatePerson — full Person from data + seed
    │       │   ├── person.test.ts     # 37 tests
    │       │   ├── world.ts           # generateWorld — WorldState + Person[] + CalendarEvent[]
    │       │   ├── world.test.ts      # 16 tests
    │       │   ├── calendar.ts        # generateCalendar — CalendarEvent[] from templates + world state
    │       │   ├── calendar.test.ts   # 12 tests — November constraint, Olympic gating, collision, determinism
    │       │   ├── bracket.ts         # generateBracket — empty TournamentBracket from entrant list + days structure
    │       │   └── bracket.test.ts    # 14 tests — structure, byes, determinism, seeding, days alignment
    │       └── engine/
    │           └── advanceWeek.ts     # Week tick entry point stub
    │
    ├── desktop/                       # Electron main process
    │   ├── package.json               # @corner-gym/desktop — depends on engine + better-sqlite3
    │   ├── tsconfig.json
    │   ├── electron-builder.yml
    │   └── src/
    │       ├── main.ts                # BrowserWindow creation, opens DB, wires IPC
    │       ├── preload.cts            # contextBridge — exposes electronAPI to renderer (CJS forced via .cts)
    │       ├── ipc.ts                 # IPC handlers: get-upcoming-events, get-all-events
    │       └── db.ts                  # SQLite layer — + calendar_events table, saveCalendar, loadCalendar, getUpcomingEvents, updateEventStatus
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
                ├── assets/
            │   ├── fonts/
            │   │   ├── RockBro.otf                    # Display font — logotype and headings
            │   │   ├── Inconsolata-Light.ttf
            │   │   ├── Inconsolata-Regular.ttf
            │   │   ├── Inconsolata-Medium.ttf
            │   │   ├── Inconsolata-SemiBold.ttf
            │   │   └── Inconsolata-Bold.ttf
            │   └── venues/                            # Venue images — {venueId}.jpg/png; missing → styled placeholder
            │       ├── arena_riga.jpg
            │       ├── daugavpils_boksa_klubs.jpg
            │       ├── daugavpils_sports_palace.jpg
            │       ├── imanta_sporta_halle.jpg
            │       ├── jelgavas_boksa_klubs.jpg
            │       ├── liepajas_boksa_klubs.jpg
            │       ├── liepajas_olimpiskais_centrs.jpg
            │       ├── olimpiskais_sporta_centrs_riga.jpg
            │       ├── riga_boksa_klubs.jpg
            │       └── riga_sporta_nams.jpg
            ├── styles/
            │   └── theme.css                          # All CSS custom properties — palette, spacing, typography, borders
            ├── components/
            │   ├── Button.tsx                         # Variants: primary, secondary, danger, ghost. Sizes: sm, md, lg
            │   ├── Input.tsx                          # Text input with label, error, disabled states
            │   ├── Card.tsx                           # Container with default, active, muted variants
            │   ├── Dropdown.tsx                       # Controlled dropdown, keyboard nav, outside-click close
            │   ├── Badge.tsx                          # 7 variants: easy/normal/hard/extreme/gift/flaw/neutral. Selectable
            │   ├── ProgressBar.tsx                    # Animated fill, CSS cubic-bezier transition
            │   ├── Icon.tsx                           # Thin wrapper around @radix-ui/react-icons — size + colour
            │   └── layout/
            │       ├── TopBar.tsx                     # Fixed 44px bar — logotype, screen title, gym/year
            │       ├── SideNav.tsx                    # Fixed left nav — 6 items with Radix icons, expand/collapse
            │       └── GameShell.tsx                  # Composes TopBar + SideNav + scrollable main — controlled nav
            └── screens/
                ├── MainMenu.tsx             # New Game / Load Game / Quit — grain overlay, Rock Bro title
                ├── NewGame.tsx              # Player name, gym name, nation, city, difficulty, seed — two-column grid
                ├── Loading.tsx              # ProgressBar + step/detail text + elapsed timer
                ├── LoadGame.tsx             # Save list with load and delete (confirm step) actions
                ├── Game.tsx                 # Placeholder in GameShell — proves load flow; shows player name, gym, year/week
                ├── Calendar.tsx             # Boxing calendar — events grouped by month, circuit badges, venue + date
                ├── SanctioningBodyPage.tsx  # Sanctioning body detail — rules table, titles, governed events
                ├── VenuePage.tsx            # Venue detail — image, description, eligibility, upcoming/past events
                └── EventFullPage.tsx        # Event full detail — venue feature, schedule, bracket placeholder, why it matters
```
