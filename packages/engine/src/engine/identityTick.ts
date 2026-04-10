// identityTick advances fighter identity states each week.
// Not every fighter transitions every week — probabilities are low.
// But over 10 years small probabilities produce a realistic distribution
// of fighters at different career stages.
//
// Transitions handled here:
//   unaware  → curious    (low probability, environmental triggers)
//   curious  → aspiring   (medium probability, soul trait multipliers)
//   competing → retired   (age, health, or loss accumulation)
//
// aspiring → competing is NOT handled here — it happens in eventTick when
// a fighter actually enters and completes their first bout.

import type { AdvanceWeekState } from '../types/advanceWeek.js'
import type { GameData } from '../data/loader.js'
import type { RNG } from '../utils/rng.js'
import type { Fighter } from '../types/fighter.js'

// hasTrait checks whether a fighter has a specific soul trait (revealed or not).
// Soul traits always exist on the fighter — revelation is the player discovery layer.
function hasTrait(fighter: Fighter, traitId: string): boolean {
  return fighter.soulTraits.some(t => t.traitId === traitId)
}

// gymHasFightersWithBouts returns true when a gym has at least one fighter
// who has competed. This acts as a "witnessed a bout" proxy — seeing active
// fighters in the gym accelerates the curious → aspiring transition.
function gymHasFightersWithBouts(gymId: string, state: AdvanceWeekState): boolean {
  const gym = state.gyms.get(gymId)
  if (gym === undefined) return false

  for (const fighterId of gym.fighterIds) {
    const fighter = state.fighters.get(fighterId)
    if (fighter === undefined) continue
    const totalBouts =
      fighter.competition.amateur.wins + fighter.competition.amateur.losses
    if (totalBouts > 0) return true
  }
  return false
}

// gymHasFightersWithWinningRecords returns true when a gym has fighters
// with winning records — used as a positive environmental signal for
// the unaware → curious transition.
function gymHasFightersWithWinningRecords(gymId: string, state: AdvanceWeekState): boolean {
  const gym = state.gyms.get(gymId)
  if (gym === undefined) return false

  for (const fighterId of gym.fighterIds) {
    const fighter = state.fighters.get(fighterId)
    if (fighter === undefined) continue
    if (fighter.competition.amateur.wins > fighter.competition.amateur.losses) return true
  }
  return false
}

// transitionUnawareToCurious checks whether an unaware fighter begins
// questioning whether they want to compete.
// Base probability: 0.5% per week (~25% per year).
// Multiplied by soul trait and environment signals.
function transitionUnawareToCurious(
  fighter: Fighter,
  gymId: string | null,
  state: AdvanceWeekState,
  rng: RNG,
): boolean {
  let prob = 0.005

  // Hungry soul: active ambition makes a fighter notice the gym around them
  if (hasTrait(fighter, 'hungry')) prob *= 2.0

  // Motivations aligned with proving oneself accelerate curiosity
  const reason = fighter.reasonForBoxingId
  if (reason === 'way_out' || reason === 'prove_something') prob *= 1.5

  // A gym with winning fighters is inspiring — it shows what is possible
  if (gymId !== null && gymHasFightersWithWinningRecords(gymId, state)) prob *= 1.3

  // Content soul: satisfied with life as it is, not seeking new challenges
  if (hasTrait(fighter, 'content')) prob *= 0.3

  return rng.next() < prob
}

// transitionCuriousToAspiring checks whether a curious fighter commits
// to wanting to compete.
// Base probability: 1% per week (~50% chance within a year).
// Multiplied significantly by experience and soul traits.
function transitionCuriousToAspiring(
  fighter: Fighter,
  gymId: string | null,
  state: AdvanceWeekState,
  rng: RNG,
): boolean {
  let prob = 0.01

  // Hungry fighters push themselves to the next stage faster
  if (hasTrait(fighter, 'hungry')) prob *= 2.0

  // Years training > 1: the fighter has put in real work and knows it
  if (fighter.boxingBackground.yearsTraining > 1) prob *= 1.5

  // Witnessing active fighters competing normalises the commitment
  if (gymId !== null && gymHasFightersWithBouts(gymId, state)) prob *= 1.8

  // Brave fighters lean into the challenge rather than talking themselves out
  if (hasTrait(fighter, 'brave')) prob *= 1.3

  // Craven fighters find reasons to delay indefinitely
  if (hasTrait(fighter, 'craven')) prob *= 0.5

  return rng.next() < prob
}

// transitionCompetingToRetired checks whether a competing fighter hangs up
// their gloves. Retirement can be driven by age, damage accumulation, or
// soul trait satisfaction. Returns the retirement reason or null if no transition.
function transitionCompetingToRetired(
  fighter: Fighter,
  _state: AdvanceWeekState,
  rng: RNG,
): 'age' | 'voluntary' | 'loss_of_drive' | null {
  let ageRetirementProb = 0
  let voluntaryProb = 0

  // Age-based retirement: probability ramps up steeply after 38
  if (fighter.age >= 38) {
    ageRetirementProb = 0.05  // 5% per week at 38+
  } else if (fighter.age >= 35) {
    // Check if health is heavily damaged (chin or durability critical)
    const chin = fighter.developedAttributes.find(a => a.attributeId === 'chin')
    const durability = fighter.developedAttributes.find(a => a.attributeId === 'durability')
    const healthBad =
      (chin !== undefined && chin.current <= 4) ||
      (durability !== undefined && durability.current <= 4)
    if (healthBad) ageRetirementProb = 0.03
  }

  // Consecutive losses create a loss-of-drive retirement signal.
  // Three losses in a row signals the arc is bending toward the exit.
  const recentBouts = fighter.competition.amateur.boutIds.slice(-3)
  const consecutiveLosses =
    recentBouts.length === 3 &&
    fighter.competition.amateur.losses >= 3
  if (consecutiveLosses) ageRetirementProb += 0.01

  // Voluntary retirement: content fighters at 32+ who have no title ambitions
  // are susceptible to deciding they've done enough
  if (
    fighter.age >= 32 &&
    hasTrait(fighter, 'content') &&
    fighter.career.ambitions.level === 'local'
  ) {
    voluntaryProb = 0.005
  }

  if (ageRetirementProb > 0 && rng.next() < ageRetirementProb) {
    return fighter.age >= 38 ? 'age' : 'loss_of_drive'
  }

  if (voluntaryProb > 0 && rng.next() < voluntaryProb) {
    return 'voluntary'
  }

  return null
}

// runIdentityTick processes all fighters for possible identity state transitions.
// Returns the count of transitions that occurred this week.
export function runIdentityTick(state: AdvanceWeekState, _data: GameData, rng: RNG): number {
  let transitions = 0

  for (const [fighterId, fighter] of state.fighters) {
    const identityState = fighter.fighterIdentity.state
    const gymId = fighter.career.currentGymId

    if (identityState === 'unaware') {
      if (transitionUnawareToCurious(fighter, gymId, state, rng)) {
        fighter.fighterIdentity.state = 'curious'
        fighter.fighterIdentity.stateChangedYear = state.year
        fighter.fighterIdentity.stateChangedWeek = state.week
        state.pendingFighterUpdates.add(fighterId)
        transitions++
      }
    } else if (identityState === 'curious') {
      if (transitionCuriousToAspiring(fighter, gymId, state, rng)) {
        fighter.fighterIdentity.state = 'aspiring'
        fighter.fighterIdentity.stateChangedYear = state.year
        fighter.fighterIdentity.stateChangedWeek = state.week
        state.pendingFighterUpdates.add(fighterId)
        transitions++
      }
    } else if (identityState === 'competing') {
      const retirementReason = transitionCompetingToRetired(fighter, state, rng)
      if (retirementReason !== null) {
        fighter.fighterIdentity.state = 'retired'
        fighter.fighterIdentity.stateChangedYear = state.year
        fighter.fighterIdentity.stateChangedWeek = state.week
        fighter.fighterIdentity.retirementReason = retirementReason
        state.pendingFighterUpdates.add(fighterId)
        transitions++
      }
    }
  }

  return transitions
}
