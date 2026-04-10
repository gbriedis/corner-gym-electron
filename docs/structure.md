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
    │   │   │   ├── difficulties.json          # 4 difficulty presets — multipliers on city modifiers and probabilities
    │   │   │   ├── rewards.json               # Rewards per circuit level and result — rep, followers, medals, belts
    │   │   │   ├── promoters.json             # 4 named world promoters, 2 templates, 2 generic voice pools
    │   │   │   ├── pro-fight-offer.json       # Offer structure definition — required fields, card positions, clause types
    │   │   │   ├── attribute-accumulation.json # Gain/regression rules for all attributes — every attribute change flows through this
    │   │   │   ├── coach-styles.json          # Coach style dimensions — emphasis, methodology, communication types
    │   │   │   ├── gym-equipment-types.json   # 12 equipment types — zone, decay, cost, training benefit
    │   │   │   ├── style-matchups.json        # 13 style matchup entries + styleThresholds per style
    │   │   │   ├── style-development.json     # tendencyStrength growth, coach influence, compatibility formula
    │   │   │   └── reasons-for-boxing.json    # Universal reason definitions — metadata for moment/ambition systems
    │   │   ├── nations/
    │   │   │   └── latvia/
    │   │   │       ├── nation.json
    │   │   │       ├── cities.json            # 8 Latvian cities with modifiers
    │   │   │       ├── names.json
    │   │   │       ├── economic-statuses.json
    │   │   │       ├── reasons-for-boxing.json
    │   │   │       ├── gym-starting-states.json  # 4 templates + city distribution for gym generation
    │   │   │       ├── gym-names.json            # 50 full names + patterns for procedural rival gym naming
    │   │   │       ├── coach-generation.json     # Specialist probability, quality ranges by tier, growth rates
    │   │   │       ├── coach-voice/
    │   │   │       │   ├── attributes.json
    │   │   │       │   ├── physical-stats.json
    │   │   │       │   └── gifts-and-flaws.json
    │   │   │       └── boxing/
    │   │   │           ├── sanctioning-bodies.json  # LBF — national body, affiliates to EUBC
    │   │   │           ├── amateur-circuit.json     # 3 domestic circuit levels
    │   │   │           ├── event-templates.json     # 3 event templates with venue pools
    │   │   │           ├── venues.json              # 16 Latvian venues — club gyms, regional halls, national arenas
    │   │   │           ├── lbf-rules.json           # LBF bout rules — 3 circuit levels × 3 age categories
    │   │   │           ├── pro-ecosystem.json       # Pro development levels 0–4 — requirements, unlocks, inbox messages
    │   │   │           └── promoters.json           # Empty promoter list — Latvian voice lines for procedural generation
    │   │   └── usa/
    │   │       ├── nation.json                  # USA nation — boxing culture 5, pro ecosystem starts at 4, performanceHint
    │   │       ├── cities.json                  # 20 US cities with modifiers — Las Vegas through Lowell
    │   │       ├── ethnicities.json             # 6 ethnicities with physical profiles, trait weights, city distributions
    │   │       ├── names.json                   # By ethnicity — 6 pools, 20+ names each
    │   │       ├── economic-statuses.json       # 6 US economic statuses — welfare through upper middle class
    │   │       ├── reasons-for-boxing.json      # 8 reasons including family_tradition and community_identity
    │   │       ├── gym-names.json               # 90+ full names — PAL, surname gyms, community names
    │   │       ├── coach-generation.json        # Higher quality ranges than Latvia — boxing culture 5
    │   │       ├── gym-starting-states.json     # 4 templates + large_city distribution
    │   │       └── boxing/
    │   │           ├── sanctioning-bodies.json  # USA Boxing — national amateur body, affiliates to IBA
    │   │           ├── amateur-circuit.json     # 4 levels — club, regional, nationals, Golden Gloves
    │   │           ├── usab-rules.json          # USA Boxing rules — 4 circuit levels × 3 age categories
    │   │           ├── event-templates.json     # 4 event templates including Golden Gloves
    │   │           ├── venues.json              # 15 venues — Kronk, MSG, MGM Grand, Gleason's
    │   │           ├── pro-ecosystem.json       # Starts at level 4 — all thresholds pre-met
    │   │           └── promoters.json           # US promoter voice lines — direct, business-focused
    │   └── international/
    │   │       └── boxing/
    │   │           ├── sanctioning-bodies.json      # EUBC (continental) + IBA (international)
    │   │           ├── circuits.json                # Baltic, European, World, Olympics circuit levels
    │   │           ├── event-templates.json         # 4 international event templates with venue pools
    │   │           ├── venues.json                  # 13 non-Latvian venues — Baltic, European, World/Olympic
    │   │           ├── eubc-rules.json              # EUBC rules — Baltic + European championship levels
    │   │           ├── iba-rules.json               # IBA rules — World Championship + Olympics
    │   │           ├── pro-sanctioning-bodies.json  # WBC, WBA, IBF, WBO, Ring Magazine
    │   │           ├── pro-title-belts.json         # 144 belts — all tiers × all bodies × 9 pro weight classes
    │   │           └── pro-rankings-structure.json  # Ranking rules, decay, mandatory defence, acquisition tiers
    │   ├── scripts/
    │   │   └── inspect-save.ts        # CLI inspection tool — reads a .db save, prints world summary + bout health + attributes + financials + top fighters
    │   └── src/
    │       ├── index.ts               # Public API — exports types + generateWorld + loadGameData + generateFighter + advanceWeek
    │       ├── types/
    │       │   ├── competition.ts     # Bout, Card, TournamentBracket, MultiDayEvent, RulesData — structural containers, no simulation logic
    │       │   ├── index.ts           # Barrel — re-exports all types including fighter sub-interfaces
    │       │   ├── person.ts          # Person, PhysicalProfile, AttributeValue, HealthValue, GiftFlawAssignment
    │       │   ├── fighter.ts         # Fighter + all sub-interfaces — extends Person, 9 layers
    │       │   ├── gym.ts             # Full Gym type — zones, equipment, staff, finances, quality, culture, reputation
    │       │   ├── coach.ts           # Coach — full type: CoachStyle, CoachFighterRelationship, Coach
    │       │   ├── manager.ts         # Manager stub — id, name, reputation, nationality
    │       │   ├── clause.ts          # Clause stub — type, details, expiresYear, expiresWeek
    │       │   ├── location.ts        # Location stub
    │       │   ├── event.ts           # GameEvent stub
    │       │   ├── bout.ts            # Bout stub
    │       │   ├── moment.ts          # Moment stub
    │       │   ├── calendar.ts        # CalendarEvent, CalendarData, EventStatus
    │       │   ├── worldState.ts      # WorldState, GymState, CityState, NationState
    │       │   ├── gameConfig.ts      # GameConfig, DifficultyModifiers, LeagueSettings, WorldSettings
    │       │   └── data/              # TypeScript interfaces for every data file
    │       │       ├── index.ts       # Barrel — re-exports everything
    │       │       ├── style.ts       # StyleMatchupsData, StyleDevelopmentData + all sub-interfaces
    │       │       ├── gym.ts         # GymStartingStatesData, GymEquipmentTypesData + sub-types
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
    │       │       ├── rewards.ts     # RewardsData — per circuit level reward definitions
    │       │       ├── ethnicities.ts # EthnicitiesData, Ethnicity, EthnicityPhysicalProfile
    │       │       └── boxing.ts      # All boxing data types — sanctioning bodies, circuits, templates, venues
    │       ├── data/
    │       │   └── loader.ts          # loadGameData() — GameData + NationBoxingData + InternationalData + attributeAccumulation
    │       ├── utils/
    │       │   └── rng.ts             # Seeded deterministic RNG (mulberry32)
    │       ├── generation/
    │       │   ├── person.ts          # generatePerson — full Person from data + seed
    │       │   ├── person.test.ts     # 37 tests
    │       │   ├── world.ts           # generateWorld — WorldState + Person[] + Fighter[] + Gym[] + CalendarEvent[]
    │       │   ├── world.test.ts      # 27 tests — determinism, persons, gyms, fighters, distribution, free agents
    │       │   ├── gym.ts             # generateGym + calculateGymQuality — full Gym from template + city data
    │       │   ├── gym.test.ts        # 17 tests — player gym, finances, equipment, quality, determinism, deduplication
    │       │   ├── calendar.ts        # generateCalendar — CalendarEvent[] from templates + world state
    │       │   ├── calendar.test.ts   # 12 tests — November constraint, Olympic gating, collision, determinism
    │       │   ├── bracket.ts         # generateBracket — empty TournamentBracket from entrant list + days structure
    │       │   ├── bracket.test.ts    # 14 tests — structure, byes, determinism, seeding, days alignment
    │       │   ├── fighter.ts         # generateFighter — complete Fighter from Person + gym assignment
    │       │   ├── fighter.test.ts    # 17 tests — fields, weight class, mental caps, ambitions, style, coachability, determinism
    │       │   └── backrun.ts         # runBackrun — 520 weeks in memory; builds 10yr calendar; annual batch writes via onYearEnd
    │       └── engine/
    │           ├── advanceWeek.ts         # Full week tick — weeklyTick + identityTick + eventTick + year rollover
    │           ├── advanceWeek.test.ts    # 15 tests — week/year advancement, decay, finances, inactivity, identity, events, backrun
    │           ├── coachEntryDecision.ts  # coachShouldEnterFighter — registration, identity, inactivity, readiness, circuit checks
    │           ├── weeklyTick.ts          # Equipment decay, gym finances, fighter inactivity regression, age advancement
    │           ├── identityTick.ts        # Identity transitions: unaware→curious, curious→aspiring, competing→retired
    │           ├── eventTick.ts           # Event resolution: club cards, regional/national tournaments
    │           ├── styleEngine.ts         # getMatchup + getEffectiveModifiers — graceful fallback for unknown style pairings
    │           ├── boutAssessment.ts      # assessBout — derives FighterBoutState + BoutConditions from input + data
    │           ├── roundResolution.ts     # resolveRound — per-round dominance, damage, knockdowns, stoppages, soul traits
    │           ├── attributeEvents.ts     # calculateAttributeEvents — gain/regression rules from attribute-accumulation.json
    │           ├── resolveBout.ts         # resolveBout — orchestrates assessment + round loop + judge scoring + damage + events
    │           └── resolveBout.test.ts    # 14 tests — determinism, skill disparity, KO, headgear, 3KD, decisions, attr events, fragile, stamina
    │
    ├── desktop/                       # Electron main process
    │   ├── package.json               # @corner-gym/desktop — depends on engine + better-sqlite3
    │   ├── tsconfig.json
    │   ├── electron-builder.yml
    │   └── src/
    │       ├── main.ts                # BrowserWindow creation, opens DB, wires IPC
    │       ├── preload.cts            # contextBridge — exposes electronAPI to renderer (CJS forced via .cts)
    │       ├── ipc.ts                 # IPC handlers — game + 7 dev-mode handlers
    │       ├── db.ts                  # SQLite layer — gyms table, saveGyms, loadGyms, getPlayerGym, getGymsByCity + calendar + bouts + brackets
    │       └── db-dev.ts              # Dev mode read-only queries — world summary, fighter list/detail, attribute distributions, bout log, gym financials
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
            │   │   ├── corner-gym-header.otf          # Display font — logotype and headings (CornerGymHeader)
            │   │   ├── RockBro.otf                    # Legacy — kept on disk, no longer wired
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
            │   ├── Bracket.tsx                        # Single elimination bracket — rounds prop, TBD slots, SVG connectors
            │   └── layout/
            │       ├── TopNav.tsx                     # Fixed 48px bar — back/forward, page name, week/finances, Advance Week
            │       ├── TopBar.tsx                     # Legacy (pre-nav rework) — kept but unused in game flow
            │       ├── SideNav.tsx                    # Fixed left nav — 6 items with Radix icons, expand/collapse
            │       └── GameShell.tsx                  # Composes TopNav + SideNav + scrollable main — controlled nav
            └── screens/
                ├── MainMenu.tsx             # New Game / Load Game / Quit — grain overlay, CornerGymHeader title
                ├── NewGame.tsx              # Player name, gym name, nation, city, difficulty, seed — two-column grid
                ├── Loading.tsx              # ProgressBar + step/detail text + elapsed timer
                ├── LoadGame.tsx             # Save list with load and delete (confirm step) actions
                ├── Game.tsx                 # Placeholder in GameShell — proves load flow; shows player name, gym, year/week
                ├── Calendar.tsx             # Boxing calendar — events grouped by month, circuit badges, venue + date
                ├── SanctioningBodyPage.tsx  # Sanctioning body detail — rules table, titles, governed events
                ├── VenuePage.tsx            # Venue detail — image, description, eligibility, upcoming/past events
                ├── EventFullPage.tsx        # Event full detail — venue feature, schedule, bracket placeholder, why it matters
                └── DevDashboard.tsx         # Dev tool — Ctrl+Shift+D or /dev; 6 sections: world overview, fighter browser, attribute distributions, bout log, gym financials, regenerate
```
