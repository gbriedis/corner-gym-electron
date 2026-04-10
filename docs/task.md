# Current Task

## Task: CLI Inspection Tool

### What To Build
A standalone CLI script that reads a Corner Gym SQLite save file and prints a simulation health report to the terminal. Used to verify backrun results without needing the full Electron app running.

### Skill To Load
`.claude/skills/new-feature/SKILL.md`

---

## Location

`packages/engine/scripts/inspect-save.ts`

Run with:
```
pnpm --filter @corner-gym/engine tsx scripts/inspect-save.ts <path-to-save.db>
```

Or add to engine package.json scripts:
```json
"inspect": "tsx scripts/inspect-save.ts"
```

Then: `pnpm --filter @corner-gym/engine inspect -- saves/latest.db`

---

## Output Format

Plain text, terminal-friendly, easy to copy-paste. Uses no external dependencies beyond what already exists in the engine package.

```
═══════════════════════════════════════════════════════
  CORNER GYM — SAVE INSPECTION REPORT
  Save: saves/latest.db
  Generated: 2026-04-10
═══════════════════════════════════════════════════════

WORLD SUMMARY
─────────────
Nations included: latvia, usa
Backrun period: 2016 → 2026 (520 weeks)

  latvia
  ├─ Cities: 8
  ├─ Gyms: 24
  ├─ Persons: 312
  ├─ Fighters: 187
  │    competing: 89  aspiring: 34  retired: 28  unaware: 36
  └─ Bouts resolved: 523

  usa
  ├─ Cities: 20
  ├─ Gyms: 180
  ├─ Persons: 2,847
  ├─ Fighters: 1,923
  │    competing: 901  aspiring: 412  retired: 287  unaware: 323
  └─ Bouts resolved: 5,241

─────────────────────────────────────────────────────
BOUT RESULTS HEALTH CHECK
─────────────────────────
Total bouts: 5,764

  By method:
  KO/TKO        34.2%  ████████░░░░░░░░░░░░
  Decision      58.1%  ██████████████░░░░░░
  Split/Maj     12.4%  of all decisions
  No Contest     0.3%

  By circuit:
  Club Card     avg end round 3.1 / 3.0 scheduled
  Regional      avg end round 4.8 / 6.0 scheduled
  National      avg end round 5.2 / 6.0 scheduled

  [TARGET: ~30-35% stoppages for amateur level]

─────────────────────────────────────────────────────
ATTRIBUTE DISTRIBUTIONS (latvia fighters)
─────────────────────────────────────────
  power        mean: 7.8  median: 8  min: 2  max: 16  stddev: 2.3
  chin         mean: 8.1  median: 8  min: 2  max: 15  stddev: 2.1
  ring_iq      mean: 4.2  median: 4  min: 1  max: 11  stddev: 1.8
  heart        mean: 5.1  median: 5  min: 1  max: 12  stddev: 1.9
  composure    mean: 4.8  median: 4  min: 1  max: 11  stddev: 1.9
  technique    mean: 6.3  median: 6  min: 1  max: 14  stddev: 2.2

  [ring_iq and mental attrs should skew low — most fighters have little experience]

─────────────────────────────────────────────────────
GYM FINANCIALS HEALTH CHECK (latvia)
─────────────────────────────────────
  Gyms in deficit (balance < 0):     3 / 24  (12.5%)
  Gyms struggling (balance < €500):  7 / 24  (29.2%)
  Gyms healthy (balance > €2000):   11 / 24  (45.8%)

  Most profitable:  Rīgas Boksa klubs  €8,420
  Most struggling:  Jēkabpils BC       €-340

─────────────────────────────────────────────────────
PRO ECOSYSTEM
─────────────
  latvia:  Level 1 — Emerging Scene  (reached week 2024-W34)
  usa:     Level 4 — Boxing Nation

─────────────────────────────────────────────────────
TOP FIGHTERS BY RECORD (latvia, competing)
──────────────────────────────────────────
  1.  Māris Kalniņš        Riga       14-2   Welterweight   age 28
  2.  Andris Ozols         Daugavpils 11-1   Lightweight    age 26
  3.  Jānis Bērziņš        Valmiera   9-3    Middleweight   age 31
  ...top 10

─────────────────────────────────────────────────────
TOP FIGHTERS BY RECORD (usa, competing)
────────────────────────────────────────
  1.  Marcus Williams      Detroit    23-2   Welterweight   age 29
  2.  Miguel Garcia        Oxnard     19-0   Lightweight    age 24
  ...top 10

═══════════════════════════════════════════════════════
```

---

## Implementation

**`packages/engine/scripts/inspect-save.ts`**

```typescript
import Database from 'better-sqlite3'
import path from 'path'

// Read save path from args
const savePath = process.argv[2]
if (!savePath) {
  console.error('Usage: tsx scripts/inspect-save.ts <path-to-save.db>')
  process.exit(1)
}

const db = new Database(path.resolve(savePath), { readonly: true })
```

Query SQLite directly — no IPC, no Electron. Raw SQL queries against the tables we already have:
- `saves` — save metadata
- `persons` — count per nation
- `fighters` — count, identity states, records (JSON parsed from data column)
- `gyms` — count, finances (JSON parsed from data column)
- `bouts` — results, methods, circuit levels
- `coaches` — count per gym

Parse `data` JSON columns for detailed stats.

**Key queries:**

```sql
-- Fighter identity distribution per nation
SELECT 
  json_extract(data, '$.nationId') as nation,
  json_extract(data, '$.fighterIdentity.state') as state,
  COUNT(*) as count
FROM fighters
WHERE saveId = ?
GROUP BY nation, state

-- Bout method distribution
SELECT 
  json_extract(data, '$.method') as method,
  COUNT(*) as count
FROM bouts  
WHERE saveId = ?
GROUP BY method

-- Attribute stats for a nation
-- Parse developedAttributes array from fighter JSON
-- Calculate mean/median/min/max per attribute

-- Gym financial summary
SELECT
  json_extract(data, '$.nationId') as nation,
  json_extract(data, '$.finances.balance') as balance,
  json_extract(data, '$.name') as name
FROM gyms
WHERE saveId = ?
ORDER BY balance DESC
```

For attribute distributions — load all fighters for a nation, parse their `developedAttributes` arrays in JS, calculate stats. Don't try to do this in SQL.

**Output helpers:**

```typescript
function bar(value: number, max: number, width: number = 20): string {
  const filled = Math.round((value / max) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function pct(value: number, total: number): string {
  return ((value / total) * 100).toFixed(1) + '%'
}

function mean(values: number[]): number { ... }
function median(values: number[]): number { ... }
function stddev(values: number[]): number { ... }
```

---

## Add to package.json

**Update `packages/engine/package.json`**

```json
{
  "scripts": {
    "inspect": "tsx scripts/inspect-save.ts"
  }
}
```

Usage after adding:
```
pnpm --filter @corner-gym/engine inspect saves/mygame.db
```

---

### Definition Of Done
- [ ] `packages/engine/scripts/inspect-save.ts` — runs without errors
- [ ] World summary section — nation counts accurate
- [ ] Bout health check — percentages match dev dashboard
- [ ] Attribute distributions — mean/median/stddev for 6 key attributes
- [ ] Gym financials — deficit/struggling/healthy breakdown
- [ ] Pro ecosystem levels shown
- [ ] Top 10 fighters by record per nation
- [ ] `pnpm --filter @corner-gym/engine inspect` runs from project root
- [ ] Output is clean, copy-pasteable
- [ ] `pnpm typecheck` clean
- [ ] `bash .claude/hooks/stop.sh` passes
- [ ] Committed: `feat: cli inspection tool`

### Notes
- Read only database connection — never write
- Parse JSON data columns in JavaScript not SQL — simpler and fast enough for this
- No external dependencies — better-sqlite3 already in the engine package
- tsx already available for running TypeScript scripts directly
- Save file location will vary — always resolve from process.argv[2]
- If saveId is ambiguous (multiple saves in one db) — use the most recent save by created_at
