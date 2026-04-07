# Data Rule

Loaded when working in `packages/engine/data/`.

## The Law
Nothing hardcoded. If it is a value that shapes the game world it lives in JSON. The engine reads it, never contains it.

## Rules
- Every JSON file must have a matching TypeScript type in `packages/engine/src/types/`
- Keys are camelCase
- Valid JSON only — no comments, no trailing commas
- Add a field to JSON → add it to the type. Remove one → remove it from the type.
- Never put JSON data inline in TypeScript files
- Never duplicate values across files
