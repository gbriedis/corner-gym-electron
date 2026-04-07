import type { WorldState } from '../types/worldState.js';

// Entry point called each week tick — takes current state, returns updated state.
// All simulation logic will be wired through here as engine modules are built.
export function advanceWeek(state: WorldState): WorldState {
  return state;
}
