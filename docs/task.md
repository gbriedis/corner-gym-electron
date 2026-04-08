# Current Task

## Task: Boxing Infrastructure Data Files

### What To Build
Boxing infrastructure data files. Domestic Latvia files, international shared files, and venues. No engine logic, no matchmaking, no simulation. Data only.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/rules/data.md`

---

## Folder Structure To Create

```
packages/engine/data/
├── nations/latvia/boxing/
│   ├── sanctioning-bodies.json
│   ├── amateur-circuit.json
│   └── event-templates.json
└── international/
    └── boxing/
        ├── sanctioning-bodies.json
        ├── circuits.json
        ├── event-templates.json
        └── venues.json
```

---

## Files To Create

### `nations/latvia/boxing/sanctioning-bodies.json`

Latvian Boxing Federation only. LBF governs all domestic amateur boxing in Latvia.

Fields per body: `id`, `label`, `level` (`"national"`), `affiliation` (references international body id), `description`, `titlesPerWeightClass` (array of title ids this body awards), `rankingSystem`.

Meta must explain: this file covers domestic bodies only. International bodies live in `international/boxing/sanctioning-bodies.json`. LBF affiliates upward to EUBC.

---

### `nations/latvia/boxing/amateur-circuit.json`

Domestic Latvian circuit levels only: `club_tournament`, `regional_open`, `national_championship`.

Fields per level: `id`, `label`, `prestige` (1-7 scale), `sanctioningBody`, `format` (`"tournament_bracket"` or `"card"`), `typicalMonths` (array of month numbers), `locationScope` (`"city"`, `"regional"`, `"national"`), `minimumBouts` (soft guide only — not a hard engine block), `frequencyPerYear`, `description`.

Meta must explain: this file covers domestic circuit levels only. Baltic, European, World, Olympics live in `international/boxing/circuits.json`. minimumBouts is a soft guide for matchmaking — the engine uses it to generate realistic fields but a coach can apply for any event. Selection events (nationals) use application-based selection — the federation publishes the accepted fighters list, rejection arrives as a federation statement in the inbox.

---

### `nations/latvia/boxing/event-templates.json`

Templates for generating domestic Latvian events on the calendar.

Templates to include:
- `club_tournament_small` — 6-12 bouts, 3-6 weight classes, city scope, 4-8 times per year
- `regional_open_standard` — 12-24 bouts, 5-8 weight classes, regional scope, 2-4 times per year
- `national_championship_annual` — 30-50 bouts, 10 weight classes, national scope, once per year, always November, host city rotation: `["riga", "daugavpils", "liepaja", "jelgava", "valmiera"]`, rotation index tracked in world state

Fields per template: `id`, `circuitLevel`, `label`, `boutCount` (`{ min, max }`), `weightClassCount`, `locationScope`, `frequencyPerYear`, `typicalMonths`, `hostCityRotation` (array, only on national_championship), `description`.

Meta must explain: these templates are read by the event generation system to procedurally create events on the calendar. Actual events are generated from these shapes — real cities, dates, and fighters are assigned at generation time. Event generation logic is not implemented here.

---

### `international/boxing/sanctioning-bodies.json`

EUBC and IBA.

Same structure as the Latvia file. `level` values: `"continental"` for EUBC, `"international"` for IBA. `affiliation`: EUBC affiliates to IBA, IBA has null.

Meta must explain: international bodies are shared across all nations. Any nation bundle can reference these ids. Adding a new nation does not require editing this file.

---

### `international/boxing/circuits.json`

International circuit levels: `baltic_championship`, `european_championship`, `world_championship`, `olympics`.

Same fields as domestic circuit levels plus:

- `frequencyYears` — how often this event occurs. Baltic: 1. European: 2. World: 2. Olympics: 4.
- `nextOccurrence` — next year this event runs. Baltic: 2027. European: 2026. World: 2027. Olympics: 2028.
- `selectionMethod` — `"open"` (anyone eligible can enter) or `"federation_selection"` (federation publishes accepted fighters, rejection via inbox statement)
- `participatingNations` — for Baltic: `["latvia", "lithuania", "estonia"]`. For European/World/Olympics: `"all"`.

Olympics and World Championship use `selectionMethod: "federation_selection"`. Baltic and European use `"open"` with federation eligibility requirements.

Meta must explain: frequencyYears drives when the engine generates this event. nextOccurrence is the next scheduled year — after the event runs the engine adds frequencyYears to get the next. Selection events work via application — fighter applies, federation evaluates all applicants against the field, publishes accepted list. Rejection arrives as federation news in the player inbox, not a direct notification.

---

### `international/boxing/event-templates.json`

Templates for international events.

Templates:
- `baltic_championship_annual` — 20-35 bouts, 10 weight classes, international scope, frequencyYears 1
- `european_championship_biennial` — 60-100 bouts, 10 weight classes, international scope, frequencyYears 2
- `world_championship_biennial` — 100-150 bouts, 10 weight classes, international scope, frequencyYears 2
- `olympics_quadrennial` — 80-120 bouts, 10 weight classes, international scope, frequencyYears 4

Add `venuePool` field — array of venue ids from `venues.json` eligible to host this event type. Club tournaments have no venue pool (city sports halls, not specific venues). National championship and above use named venues.

---

### `international/boxing/venues.json`

Real boxing venues used for significant events. Claude Code researches and populates real venues with accurate details.

Fields per venue: `id`, `name`, `city`, `country`, `capacity`, `description`, `eligibleFor` (array of circuit level ids this venue is suitable for).

Cover:
- Major Latvian venues — arenas in Riga, Daugavpils, Liepāja capable of hosting national events
- Baltic region venues — venues in Vilnius, Tallinn for Baltic championships
- European venues — 8-10 major European boxing arenas used for continental events
- World/Olympic venues — 5-6 historically significant world boxing venues

Each venue must have accurate real-world capacity. Description should note what makes this venue significant to boxing.

Meta must explain: venues are assigned to events at generation time by the engine picking from the eligible pool. Adding a new venue requires only adding an entry here — no engine code changes.

---

### Definition Of Done
- [ ] All 7 files created and valid JSON
- [ ] All files have meta blocks
- [ ] `nations/latvia/boxing/` folder exists with 3 files
- [ ] `international/boxing/` folder exists with 4 files
- [ ] frequencyYears and nextOccurrence on all international circuit levels
- [ ] Venue capacities are real and accurate — research before writing
- [ ] `docs/structure.md` updated
- [ ] `docs/data-registry.md` — all 7 files marked `[x]`
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: boxing infrastructure data — domestic + international`

### Notes
- Data only — no TypeScript types, no engine logic this session
- minimumBouts is always a soft guide — never a hard engine block
- Latvia domestic files must not reference EUBC or IBA directly in circuit levels — those live in international/
- Venue research: use real arena names, real cities, real capacities — do not invent venues
- hostCityRotation on national_championship drives actual rotation — engine tracks current index in world state
