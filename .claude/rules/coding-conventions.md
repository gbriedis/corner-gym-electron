# Coding Conventions

## TypeScript
- Strict mode. No `any`. Explicit return types on all functions.
- Interfaces for object shapes. Types for unions.
- No implicit returns.

## React
- Functional components only. Hooks for all state.
- Props interfaces defined above the component.
- Tailwind classes only — no inline styles.
- Components display state. They never compute simulation logic.

## Engine
- Pure functions. Data in, result out. No hidden state.
- No engine function imports anything from UI.
- JSON data is loaded at startup and injected — never read mid-simulation.

## Comments
Comment why, not what. Only on engine functions and simulation decisions.

Good:
```typescript
// Minimum 4 weeks before a soul trait can be revealed.
// Prevents week-one reveals that feel random rather than earned.
```

Never:
- Comment obvious code
- Leave TODOs in committed code — log in lessons.md or fix it
- Write comments that go stale without being updated

## General
- No magic numbers — constants in JSON data or a constants file
- No commented-out code committed
- One clear responsibility per file
- Imports: external → internal packages → local. Blank line between groups.
