# Current Task

## Task: Fix JSONs + Fonts + CSS Variables + Component Library + Nav + Restyle

### What To Build
Fix two broken JSON files, wire fonts, establish the design system, build the component library, add navigation, restyle all existing screens. Do in order — JSON fixes first, then design system, then components, then screens.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`
`.claude/skills/public/frontend-design/SKILL.md`

---

## Part 1 — Fix JSON Files

**Fix `packages/engine/data/universal/game-config-defaults.json`**

`populationPerCity` must be tier-based — a flat number ignores city size entirely. Replace:
```json
"populationPerCity": 200
```
With:
```json
"populationPerCity": {
  "small_town": 150,
  "mid_city": 400,
  "capital": 1200
}
```

Update the type in `src/types/gameConfig.ts` — `worldSettings.populationPerCity` changes from `number` to `Record<string, number>`.

Update `generateWorld()` to look up population by city population type when generating persons per city.

---

**Fix `packages/engine/data/universal/difficulties.json`**

Normal difficulty must not list modifiers at 1.0 — those are the defaults, listing them is noise. The engine applies 1.0 when a field is absent.

Rule: only list modifiers that differ from 1.0. Normal difficulty has zero modifiers — empty object.

```json
{
  "id": "normal",
  "label": "Normal",
  "modifiers": {}
}
```

Easy, hard, extreme keep their modifiers but review them — only fields that genuinely differ from baseline belong here.

Update `DifficultyModifiers` type to make all fields optional: `Partial<DifficultyModifiers>`. Update the engine's difficulty merge function to use 1.0 as fallback for any absent field.

---

## Part 2 — Fonts

**Move fonts from root `/fonts` to `packages/ui/src/assets/fonts/`**

Two fonts are in the root fonts folder. Move them to the correct location.

- Rock Bro — display font, used for the Corner Gym logotype only
- Inconsolata — body font, used for all UI text

Wire both into the project:
- Add `@font-face` declarations in `packages/ui/src/index.css`
- Inconsolata also available via Google Fonts as fallback

---

## Part 3 — Design System

**`packages/ui/src/styles/theme.css`**

CSS custom properties. Single source of truth. Every colour, spacing, and typography value in the UI comes from here. Never use raw hex values in components.

```css
:root {
  /* Palette — nostalgOS 12 */
  --color-bg-dark:     #272a32;
  --color-bg-mid:      #21525a;
  --color-bg-light:    #dad4c9;
  --color-text-primary: #dad4c9;
  --color-text-muted:  #deada5;
  --color-accent-red:  #dc6250;
  --color-accent-gold: #ffd183;
  --color-accent-amber:#eeb24a;
  --color-accent-green:#55927f;
  --color-accent-blue: #5a8bde;
  --color-accent-blue-dark: #2152a5;
  --color-accent-purple: #b89ce9;
  --color-accent-purple-dark: #844790;

  /* Typography */
  --font-display: 'Rock Bro', serif;
  --font-body: 'Inconsolata', monospace;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  /* Border radius */
  --radius-sm: 2px;
  --radius-md: 4px;

  /* Transitions */
  --transition-fast: 120ms ease;
  --transition-base: 200ms ease;
}
```

Import `theme.css` in `main.tsx` before anything else.

---

## Part 4 — Component Library

**`packages/ui/src/components/`**

Build these components. Every component uses CSS variables only — no raw hex values, no Tailwind colour classes that bypass the theme.

Each component must handle all relevant states. No half-built components.

---

**`Button.tsx`**

Variants: `primary`, `secondary`, `danger`, `ghost`
Sizes: `sm`, `md`, `lg`
States: default, hover, active, disabled, loading

Primary uses `--color-accent-amber` background, dark text.
Secondary uses `--color-bg-mid` background, `--color-text-primary` text.
Danger uses `--color-accent-red`.
Ghost is transparent with border.

Loading state shows a subtle pulse animation — no spinner, just opacity pulse on the text.

---

**`Input.tsx`**

States: default, focused, error, disabled
Background `--color-bg-dark`, border `--color-bg-mid`, focused border `--color-accent-amber`.
Error border `--color-accent-red` with optional error message below.
Label above input. Monospace font throughout.

---

**`Card.tsx`**

Variants: `default`, `active`, `muted`
Background `--color-bg-mid`. Subtle border. Padding variants sm/md/lg.
Active variant has left border accent in `--color-accent-amber`.

---

**`Dropdown.tsx`**

Controlled component. Open/closed state. Options list. Selected state highlighted in `--color-accent-amber`.
Keyboard navigable. Closes on outside click.

---

**`Badge.tsx`**

For difficulty labels, status indicators, small tags.
Variants map to semantic colours: `easy` → green, `normal` → blue, `hard` → amber, `extreme` → red, `gift` → purple, `flaw` → purple-dark.

---

**`ProgressBar.tsx`**

Used on loading screen. Animated fill. Label and percentage optional.
Fill colour `--color-accent-green`. Track `--color-bg-mid`.

---

## Part 5 — Navigation

**`packages/ui/src/components/layout/TopBar.tsx`**

Fixed top bar. Dark background `--color-bg-dark`. Subtle bottom border.

Left side: Corner Gym logotype in Rock Bro font. Small, not dominant.
Centre: current screen title.
Right side: gym name + year/week display (once in game). Greyed out on menu screens.

---

**`packages/ui/src/components/layout/SideNav.tsx`**

Visible only in-game. Left side, fixed.
Navigation items: Gym, Fighters, Inbox, World, Finances.
Active item has left accent bar in `--color-accent-amber`.
Collapsed by default on smaller windows — icon only. Expanded shows label.
Items use `--font-body`. Uppercase, tracked letter-spacing.

---

**`packages/ui/src/components/layout/GameShell.tsx`**

Wraps in-game screens. Renders TopBar + SideNav + main content area.
Main content area fills remaining space. Scrollable.

---

## Part 6 — Restyle Existing Screens

Using the component library and design system, restyle all five existing screens. No new functionality — just apply the design system properly.

**MainMenu.tsx**
- Full screen, `--color-bg-dark` background
- Corner Gym in Rock Bro, large, centred, `--color-accent-amber`
- Subtitle in Inconsolata, muted
- Three Button components stacked, variant `primary` for New Game, `secondary` for Load Game, `ghost` for Quit
- Subtle grain texture or noise overlay for atmosphere — CSS only

**NewGame.tsx**
- Use Input components for player name, gym name, seed
- Use Dropdown for nation and city
- Use Badge components for difficulty selection — four in a row, clicking selects that difficulty
- Start Game uses Button variant `primary`, large
- Layout: two-column on wider screens, single column on narrow

**Loading.tsx**
- Dark screen, centred
- ProgressBar component
- Current step in `--color-text-primary`, detail in `--color-text-muted`
- Elapsed time small, bottom right
- Subtle animation — the progress bar fill should feel alive, not mechanical

**LoadGame.tsx**
- List of Card components — one per save
- Each card: gym name bold, player name + city muted, difficulty Badge, year/week, last played
- Delete button variant `danger`, small
- Load button variant `primary`, small
- Empty state: centred message in muted text

**Game.tsx** (placeholder)
- Wrapped in GameShell
- Centred welcome message using design system typography
- Year/week display

---

### Definition Of Done
- [ ] `game-config-defaults.json` — populationPerCity is tier-based
- [ ] `difficulties.json` — normal has empty modifiers, all types updated to Partial
- [ ] `generateWorld()` uses tier-based population lookup
- [ ] Fonts moved to `packages/ui/src/assets/fonts/`
- [ ] `theme.css` created, imported in `main.tsx`
- [ ] All 6 components built with all states
- [ ] TopBar, SideNav, GameShell layout components built
- [ ] All 5 screens restyled using component library
- [ ] No raw hex values in any component — CSS variables only
- [ ] `pnpm dev` — full flow looks correct, fonts load, palette applied
- [ ] `pnpm typecheck` clean
- [ ] `docs/structure.md` updated
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: design system, component library, nav, restyle`

### Notes
- Read the frontend-design skill fully before writing a single component
- The aesthetic direction: retro-utilitarian. Feels like old terminal software that was designed with care. Not flashy. Not modern SaaS. Something with character and weight.
- Rock Bro is display only — logotype and major headings. Everything else is Inconsolata.
- CSS variables only — never bypass the theme with raw values
- Components come before screens — build all components first, then assemble screens from them
- The grain/noise texture on MainMenu is CSS only — no image files
