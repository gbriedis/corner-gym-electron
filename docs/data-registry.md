# Corner Gym — Data & Implementation Registry

> Tracks every data file and engine module.
> [ ] planned — not created yet
> [~] partial — exists, not complete or not wired
> [x] done    — exists, complete, wired, tested
>
> Updated every session where data files or engine modules change.
> Do NOT list folder paths that don't exist — only actual files.

---

## Engine — Types
| State | File |
|-------|------|
| [x] | `packages/engine/src/types/person.ts` |
| [x] | `packages/engine/src/types/gameConfig.ts` |
| [x] | `packages/engine/src/types/worldState.ts` |
| [x] | `packages/engine/src/types/calendar.ts` |
| [x] | `packages/engine/src/types/competition.ts` |
| [x] | `packages/engine/src/types/index.ts` |
| [ ] | `packages/engine/src/types/fighter.ts` |
| [ ] | `packages/engine/src/types/gym.ts` |
| [ ] | `packages/engine/src/types/location.ts` |
| [ ] | `packages/engine/src/types/event.ts` |
| [ ] | `packages/engine/src/types/moment.ts` |

## Engine — Data Types
| State | File |
|-------|------|
| [x] | `packages/engine/src/types/data/index.ts` |
| [x] | `packages/engine/src/types/data/boxing.ts` |
| [x] | `packages/engine/src/types/data/meta.ts` |
| [x] | `packages/engine/src/types/data/soulTraits.ts` |
| [x] | `packages/engine/src/types/data/attributes.ts` |
| [x] | `packages/engine/src/types/data/weightClasses.ts` |
| [x] | `packages/engine/src/types/data/physicalStats.ts` |
| [x] | `packages/engine/src/types/data/health.ts` |
| [x] | `packages/engine/src/types/data/giftsAndFlaws.ts` |
| [x] | `packages/engine/src/types/data/nation.ts` |
| [x] | `packages/engine/src/types/data/cities.ts` |
| [x] | `packages/engine/src/types/data/names.ts` |
| [x] | `packages/engine/src/types/data/economicStatuses.ts` |
| [x] | `packages/engine/src/types/data/reasonsForBoxing.ts` |
| [x] | `packages/engine/src/types/data/coachVoice.ts` |
| [x] | `packages/engine/src/types/data/developmentProfiles.ts` |

## Engine — Utilities
| State | File |
|-------|------|
| [x] | `packages/engine/src/utils/rng.ts` |
| [x] | `packages/engine/src/data/loader.ts` |

## Engine — Generation
| State | File |
|-------|------|
| [x] | `packages/engine/src/generation/person.ts` |
| [x] | `packages/engine/src/generation/world.ts` |
| [x] | `packages/engine/src/generation/calendar.ts` |
| [x] | `packages/engine/src/generation/bracket.ts` |

## Engine — Loop
| State | File |
|-------|------|
| [ ] | `packages/engine/src/engine/advanceWeek.ts` |
| [ ] | `packages/engine/src/engine/world.ts` |
| [ ] | `packages/engine/src/engine/gym.ts` |
| [ ] | `packages/engine/src/engine/training.ts` |
| [ ] | `packages/engine/src/engine/people.ts` |
| [ ] | `packages/engine/src/engine/moments.ts` |
| [ ] | `packages/engine/src/engine/surface.ts` |

## Engine — Simulation
| State | File |
|-------|------|
| [ ] | `packages/engine/src/simulation/fights.ts` |
| [ ] | `packages/engine/src/simulation/development.ts` |
| [ ] | `packages/engine/src/simulation/injuries.ts` |

## Data — Universal
| State | File |
|-------|------|
| [x] | `packages/engine/data/universal/soul-traits.json` |
| [x] | `packages/engine/data/universal/attributes.json` |
| [x] | `packages/engine/data/universal/weight-classes.json` |
| [x] | `packages/engine/data/universal/physical-stats.json` |
| [x] | `packages/engine/data/universal/health.json` |
| [x] | `packages/engine/data/universal/gifts-and-flaws.json` |
| [x] | `packages/engine/data/universal/development-profiles.json` |
| [x] | `packages/engine/data/universal/game-config-defaults.json` |
| [x] | `packages/engine/data/universal/difficulties.json` |

## Data — Nations: Latvia
| State | File |
|-------|------|
| [x] | `packages/engine/data/nations/latvia/nation.json` |
| [x] | `packages/engine/data/nations/latvia/cities.json` |
| [x] | `packages/engine/data/nations/latvia/names.json` |
| [x] | `packages/engine/data/nations/latvia/economic-statuses.json` |
| [x] | `packages/engine/data/nations/latvia/reasons-for-boxing.json` |
| [x] | `packages/engine/data/nations/latvia/coach-voice/attributes.json` |
| [x] | `packages/engine/data/nations/latvia/coach-voice/physical-stats.json` |
| [x] | `packages/engine/data/nations/latvia/coach-voice/gifts-and-flaws.json` |

## Data — People
| State | File |
|-------|------|
| [ ] | `packages/engine/data/people/physical-gifts/definitions.json` |

## Data — Gym
| State | File |
|-------|------|
| [ ] | `packages/engine/data/gym/equipment/types.json` |
| [ ] | `packages/engine/data/gym/staff-roles/definitions.json` |

## Data — Moments
| State | File |
|-------|------|
| [ ] | `packages/engine/data/moments/templates/soul-reveals.json` |
| [ ] | `packages/engine/data/moments/templates/relationship-shifts.json` |
| [ ] | `packages/engine/data/moments/templates/training-events.json` |
| [ ] | `packages/engine/data/moments/templates/fight-aftermath.json` |
| [ ] | `packages/engine/data/moments/templates/culture-events.json` |
| [ ] | `packages/engine/data/moments/templates/finance-events.json` |

## Data — Finance
| State | File |
|-------|------|
| [ ] | `packages/engine/data/finance/constants/latvia.json` |

## Data — Boxing: Latvia (Domestic)
| State | File |
|-------|------|
| [x] | `packages/engine/data/nations/latvia/boxing/sanctioning-bodies.json` |
| [x] | `packages/engine/data/nations/latvia/boxing/amateur-circuit.json` |
| [x] | `packages/engine/data/nations/latvia/boxing/event-templates.json` |
| [x] | `packages/engine/data/nations/latvia/boxing/venues.json` |
| [x] | `packages/engine/data/nations/latvia/boxing/lbf-rules.json` |

## Data — Boxing: International
| State | File |
|-------|------|
| [x] | `packages/engine/data/international/boxing/sanctioning-bodies.json` |
| [x] | `packages/engine/data/international/boxing/circuits.json` |
| [x] | `packages/engine/data/international/boxing/event-templates.json` |
| [x] | `packages/engine/data/international/boxing/venues.json` |
| [x] | `packages/engine/data/international/boxing/eubc-rules.json` |
| [x] | `packages/engine/data/international/boxing/iba-rules.json` |

## Desktop
| State | File |
|-------|------|
| [x] | `packages/desktop/src/main.ts` |
| [x] | `packages/desktop/src/preload.cts` |
| [x] | `packages/desktop/src/ipc.ts` |
| [x] | `packages/desktop/src/db.ts` — bouts, cards, tournament_brackets, multi_day_events tables + typed functions |

## UI — Assets & Styles
| State | File |
|-------|------|
| [x] | `packages/ui/src/assets/fonts/RockBro.otf` |
| [x] | `packages/ui/src/assets/fonts/Inconsolata-*.ttf` |
| [~] | `packages/ui/src/assets/venues/` — 10 Latvian venue images present; remaining venues show styled placeholder. |
| [x] | `packages/ui/src/index.css` |
| [x] | `packages/ui/src/styles/theme.css` |

## UI — Components
| State | File |
|-------|------|
| [x] | `packages/ui/src/components/Button.tsx` |
| [x] | `packages/ui/src/components/Input.tsx` |
| [x] | `packages/ui/src/components/Card.tsx` |
| [x] | `packages/ui/src/components/Dropdown.tsx` |
| [x] | `packages/ui/src/components/Badge.tsx` |
| [x] | `packages/ui/src/components/ProgressBar.tsx` |
| [x] | `packages/ui/src/components/layout/TopBar.tsx` |
| [x] | `packages/ui/src/components/layout/SideNav.tsx` |
| [x] | `packages/ui/src/components/layout/GameShell.tsx` |

## UI — Screens
| State | File |
|-------|------|
| [x] | `packages/ui/src/electron.d.ts` |
| [x] | `packages/ui/src/store/gameStore.ts` |
| [x] | `packages/ui/src/ipc/client.ts` |
| [x] | `packages/ui/src/screens/MainMenu.tsx` |
| [x] | `packages/ui/src/screens/NewGame.tsx` |
| [x] | `packages/ui/src/screens/Loading.tsx` |
| [x] | `packages/ui/src/screens/LoadGame.tsx` |
| [x] | `packages/ui/src/screens/Game.tsx` |
| [x] | `packages/ui/src/screens/Calendar.tsx` — QoL: cell colour split, click-outside, nav limit, future landmarks, sanctioning body + venue links, View Full Details |
| [x] | `packages/ui/src/screens/SanctioningBodyPage.tsx` — rules table, titles, governed events; reads from gameData store |
| [x] | `packages/ui/src/screens/VenuePage.tsx` — hero image, description, eligibility, upcoming/past events via IPC |
| [x] | `packages/ui/src/screens/EventFullPage.tsx` — venue feature, schedule, bracket placeholder, why it matters |
| [ ] | `packages/ui/src/screens/Gym.tsx` |
| [ ] | `packages/ui/src/screens/Inbox.tsx` |
| [ ] | `packages/ui/src/screens/Fighters.tsx` |
| [ ] | `packages/ui/src/screens/World.tsx` |
| [ ] | `packages/ui/src/screens/Finances.tsx` |
