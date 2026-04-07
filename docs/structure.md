# Corner Gym — Project Structure

> Reflects only what actually exists on disk right now.
> Updated every session where files are added, moved, or deleted.
> Do not list planned files — those live in data-registry.md.

---

```
corner-gym/
├── CLAUDE.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
│
├── .claude/
│   ├── settings.json
│   ├── lessons.md
│   ├── hooks/
│   │   └── stop.sh
│   ├── rules/
│   │   ├── coding-conventions.md
│   │   └── data.md
│   ├── skills/
│   │   ├── new-feature/SKILL.md
│   │   ├── engine/SKILL.md
│   │   └── moments/SKILL.md
│   ├── agents/
│   │   ├── builder/CLAUDE.md
│   │   └── reviewer/CLAUDE.md
│   └── commands/
│       └── review.md
│
├── docs/
│   ├── task.md
│   ├── structure.md
│   └── data-registry.md
│
└── packages/
    └── engine/
        ├── package.json
        ├── tsconfig.json
        ├── vitest.config.ts
        └── src/
            └── index.ts
```

---

> Rule: If a file exists in the repo but not here, add it.
> If a file is listed here but was deleted, remove it.
> This file is never aspirational — only factual.
