# Skill: Engine

Load this skill when working in `packages/engine/`.

## What The Engine Is
Pure TypeScript simulation. No UI dependencies. No Electron dependencies. Runs headless.

## Advance Week — Six Steps In Order
1. World ticks — background sim resolves, full sim updates, rankings and news generate
2. Gym ticks — finances move, equipment degrades, staff resolves
3. Training runs — fighters processed, development calculated, relationships shift, moments flagged
4. People live — loyalty shifts, rival gyms move, culture fit evaluated
5. Events queue — everything that crossed a threshold gets queued
6. Surface — inbox populated, popups flagged

## Simulation Tiers
- Full sim: your nation + all interacted entities — everything runs
- Background sim: rest of world — results and records only, no weekly processing
- Entities promote to full sim when player interacts with them

## Rules
- Every function: data in, result out
- All randomness through seeded RNG — results must be reproducible
- Moment triggers evaluate thresholds — they never fire randomly
- Every engine function gets a test

## Key Files
| File | Responsibility |
|------|---------------|
| `src/engine/advanceWeek.ts` | Orchestrates the six steps |
| `src/utils/rng.ts` | Seeded RNG |
| `src/data/loader.ts` | Loads JSON into typed objects at startup |
| `src/types/` | All TypeScript interfaces |
