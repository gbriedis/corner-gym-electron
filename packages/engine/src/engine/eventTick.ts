// eventTick checks the calendar for events this week and resolves them.
// For the backrun, all event resolution is statistical — no exchange logs,
// no moments, no inbox events. Only outcomes matter.
//
// Uses coachShouldEnterFighter to populate events with real fighters.
// Uses resolveBout for all bout outcomes so the same simulation logic
// runs during the backrun and live play.

import { resolveBout } from './resolveBout.js'
import { coachShouldEnterFighter } from './coachEntryDecision.js'

import type { AdvanceWeekState } from '../types/advanceWeek.js'
import type { GameData } from '../data/loader.js'
import type { RNG } from '../utils/rng.js'
import type { Fighter } from '../types/fighter.js'
import type { BoutResolutionInput } from '../types/resolution.js'
import type { CalendarEvent } from '../types/calendar.js'

// collectEligibleFighters returns all fighters from gyms matching the scope predicate
// who pass the coach entry decision for this event.
function collectEligibleFighters(
  event: CalendarEvent,
  state: AdvanceWeekState,
  gymPredicate: (gymId: string) => boolean,
): Fighter[] {
  const eligible: Fighter[] = []

  for (const [gymId, gym] of state.gyms) {
    if (!gymPredicate(gymId)) continue

    // Find the gym's head coach (first staff member with head_coach role)
    const headCoachStaff = gym.staffMembers.find(s => s.role === 'head_coach')
    let coach = null
    if (headCoachStaff !== undefined) {
      // Find coach by personId in the coaches map
      for (const [, c] of state.coaches) {
        if (c.gymId === gymId && c.role === 'head_coach') {
          coach = c
          break
        }
      }
    }

    for (const fighterId of gym.fighterIds) {
      const fighter = state.fighters.get(fighterId)
      if (fighter === undefined) continue

      if (coachShouldEnterFighter(fighter, event, coach, state.year, state.week)) {
        eligible.push(fighter)
      }
    }
  }

  return eligible
}

// groupByWeightClass partitions an array of fighters by their weight class.
function groupByWeightClass(fighters: Fighter[]): Map<string, Fighter[]> {
  const groups = new Map<string, Fighter[]>()
  for (const f of fighters) {
    const wc = f.competition.weightClassId
    const bucket = groups.get(wc) ?? []
    bucket.push(f)
    groups.set(wc, bucket)
  }
  return groups
}

// pairFighters matches fighters for bouts. Fighters are sorted by readiness
// so similar-quality fighters meet each other — the most realistic simulation
// of how a show's matchmaker would pair competitors.
function pairFighters(fighters: Fighter[]): Array<[Fighter, Fighter]> {
  if (fighters.length < 2) return []

  // Sort by readiness descending — best matched with second best, etc.
  const sorted = [...fighters].sort((a, b) => b.career.readiness - a.career.readiness)
  const pairs: Array<[Fighter, Fighter]> = []

  for (let i = 0; i + 1 < sorted.length; i += 2) {
    pairs.push([sorted[i], sorted[i + 1]])
  }

  return pairs
}

// applyBoutResultToFighter updates a fighter's record and career state after a bout.
// The aspiring → competing identity transition fires here on first competition.
function applyBoutResultToFighter(
  fighter: Fighter,
  isWinner: boolean | null,
  boutId: string,
  state: AdvanceWeekState,
): void {
  const fighterId = fighter.id

  fighter.competition.amateur.boutIds.push(boutId)
  if (isWinner === true) {
    fighter.competition.amateur.wins++
    fighter.competition.amateur.currentLosingStreak = 0
  } else if (isWinner === false) {
    fighter.competition.amateur.losses++
    fighter.competition.amateur.currentLosingStreak++
  } else {
    // Draw resets the losing streak — a draw is not a loss
    fighter.competition.amateur.currentLosingStreak = 0
  }

  fighter.career.lastBoutYear = state.year
  fighter.career.lastBoutWeek = state.week

  // First official bout transitions aspiring → competing.
  // The fighter has crossed the line from wanting to compete to being a competitor.
  const totalBouts =
    fighter.competition.amateur.wins + fighter.competition.amateur.losses
  if (totalBouts === 1 && fighter.fighterIdentity.state === 'aspiring') {
    fighter.fighterIdentity.state = 'competing'
    fighter.fighterIdentity.stateChangedYear = state.year
    fighter.fighterIdentity.stateChangedWeek = state.week

    // Register the fighter with the sanctioning body if not already registered
    if (fighter.competition.status === 'unregistered') {
      fighter.competition.status = 'amateur'
    }
  }

  state.pendingFighterUpdates.add(fighterId)
}

// applyBoutAttributeEvents applies attribute gains from a bout directly to the fighter
// and queues both the history events (for SQLite) and the fighter record (for persistence).
// The delta must be applied in memory immediately — fighters must grow across the backrun,
// not just have events queued that never touch developedAttributes.current.
function applyBoutAttributeEvents(
  fighterId: string,
  events: import('../types/fighter.js').AttributeHistoryEvent[],
  state: AdvanceWeekState,
): void {
  if (events.length === 0) return

  const fighter = state.fighters.get(fighterId)
  if (fighter === undefined) return

  // Apply each delta to the fighter's current attribute value
  for (const event of events) {
    const attr = fighter.developedAttributes.find(a => a.attributeId === event.attributeId)
    if (attr !== undefined) {
      attr.current = Math.min(attr.currentPotential, Math.max(0, attr.current + event.delta))
    }
  }

  // Queue history events for SQLite persistence
  const existing = state.pendingAttributeEvents.get(fighterId) ?? []
  state.pendingAttributeEvents.set(fighterId, [...existing, ...events])

  // Mark fighter dirty so the year-end batch writes updated attributes
  state.pendingFighterUpdates.add(fighterId)
}

// resolveClubCard processes a club card event.
// Finds fighters from gyms in the event's city, pairs them by weight class,
// resolves each bout, and updates records and gym reputation.
function resolveClubCard(
  event: CalendarEvent,
  state: AdvanceWeekState,
  data: GameData,
  rng: RNG,
): number {
  const eligible = collectEligibleFighters(
    event,
    state,
    (gymId) => state.gyms.get(gymId)?.cityId === event.cityId,
  )

  const byWeight = groupByWeightClass(eligible)
  let boutsResolved = 0

  for (const [, fighters] of byWeight) {
    const pairs = pairFighters(fighters)

    for (const [fighterA, fighterB] of pairs) {
      const boutId = `backrun_${event.id}_${fighterA.id}_${fighterB.id}`

      const coachA = fighterA.career.coachId !== null
        ? (state.coaches.get(fighterA.career.coachId) ?? null)
        : null
      const coachB = fighterB.career.coachId !== null
        ? (state.coaches.get(fighterB.career.coachId) ?? null)
        : null

      const input: BoutResolutionInput = {
        boutId,
        fighterA,
        fighterB,
        coachA,
        coachB,
        circuitLevel: event.circuitLevel,
        ageCategoryId: 'senior',  // backrun uses senior category for simplicity
        eventId: event.id,
        year: state.year,
        week: state.week,
      }

      const result = resolveBout(input, data, rng)
      state.pendingBoutResults.push(result)

      const aWon = result.winnerId === fighterA.id ? true : result.winnerId === null ? null : false
      const bWon = result.winnerId === fighterB.id ? true : result.winnerId === null ? null : false

      applyBoutResultToFighter(fighterA, aWon, boutId, state)
      applyBoutResultToFighter(fighterB, bWon, boutId, state)

      applyBoutAttributeEvents(fighterA.id, result.fighterAAttributeEvents, state)
      applyBoutAttributeEvents(fighterB.id, result.fighterBAttributeEvents, state)

      // Gym reputation: each win adds local rep, dominant wins add more.
      // Small increments accumulate over years into meaningful reputation differences.
      if (result.winnerId !== null) {
        const winnerGymId =
          result.winnerId === fighterA.id
            ? (fighterA.career.currentGymId ?? null)
            : (fighterB.career.currentGymId ?? null)

        if (winnerGymId !== null) {
          const winnerGym = state.gyms.get(winnerGymId)
          if (winnerGym !== undefined) {
            const repGain = result.method === 'ko' || result.method === 'tko' ? 3 : 1
            winnerGym.reputation.local = Math.min(100, winnerGym.reputation.local + repGain)
            state.pendingGymUpdates.add(winnerGymId)
          }
        }
      }

      event.boutIds.push(boutId)
      boutsResolved++
    }
  }

  event.status = 'completed'
  return boutsResolved
}

// resolveTournament processes regional or national tournament events.
// Collects entrants from the entire nation, brackets them by weight class,
// and resolves rounds until each weight class has a champion.
// National championships additionally award title status.
function resolveTournament(
  event: CalendarEvent,
  state: AdvanceWeekState,
  data: GameData,
  rng: RNG,
): number {
  // Golden Gloves is equivalent to the national championship for title purposes
  const isNational = event.circuitLevel === 'national_championship' || event.circuitLevel === 'golden_gloves'

  const eligible = collectEligibleFighters(
    event,
    state,
    (gymId) => state.gyms.get(gymId)?.nationId === event.nationId,
  )

  const byWeight = groupByWeightClass(eligible)
  let boutsResolved = 0

  for (const [weightClassId, fighters] of byWeight) {
    if (fighters.length < 2) continue

    // Shuffle fighters before pairing — tournaments have random draws.
    // Using RNG ensures reproducibility: same seed = same bracket draw.
    const shuffled = [...fighters]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i)
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Single-elimination round structure — run rounds until one fighter remains.
    let round = shuffled
    while (round.length >= 2) {
      const nextRound: Fighter[] = []
      const pairs = pairFighters(round)

      for (const [fighterA, fighterB] of pairs) {
        const boutId = `backrun_${event.id}_${weightClassId}_${fighterA.id}_${fighterB.id}`

        const coachA = fighterA.career.coachId !== null
          ? (state.coaches.get(fighterA.career.coachId) ?? null)
          : null
        const coachB = fighterB.career.coachId !== null
          ? (state.coaches.get(fighterB.career.coachId) ?? null)
          : null

        const input: BoutResolutionInput = {
          boutId,
          fighterA,
          fighterB,
          coachA,
          coachB,
          circuitLevel: event.circuitLevel,
          ageCategoryId: 'senior',
          eventId: event.id,
          year: state.year,
          week: state.week,
        }

        const result = resolveBout(input, data, rng)
        state.pendingBoutResults.push(result)

        const aWon = result.winnerId === fighterA.id ? true : result.winnerId === null ? null : false
        const bWon = result.winnerId === fighterB.id ? true : result.winnerId === null ? null : false

        applyBoutResultToFighter(fighterA, aWon, boutId, state)
        applyBoutResultToFighter(fighterB, bWon, boutId, state)

        applyBoutAttributeEvents(fighterA.id, result.fighterAAttributeEvents, state)
        applyBoutAttributeEvents(fighterB.id, result.fighterBAttributeEvents, state)

        // Winner advances to next round
        const winner = result.winnerId !== null
          ? (result.winnerId === fighterA.id ? fighterA : fighterB)
          : fighterA  // draws advance fighter A by convention

        nextRound.push(winner)
        event.boutIds.push(boutId)
        boutsResolved++
      }

      // Odd fighter out gets a bye — advances automatically
      if (round.length % 2 !== 0) {
        nextRound.push(round[round.length - 1])
      }

      round = nextRound
    }

    // round[0] is the tournament champion in this weight class.
    if (isNational && round.length === 1) {
      const champion = round[0]

      // National champion gets a significant gym reputation boost.
      // This is the highest achievement in the domestic amateur circuit.
      const champGymId = champion.career.currentGymId
      if (champGymId !== null) {
        const champGym = state.gyms.get(champGymId)
        if (champGym !== undefined) {
          champGym.reputation.national = Math.min(100, champGym.reputation.national + 10)
          champGym.reputation.regional = Math.min(100, champGym.reputation.regional + 5)
          state.pendingGymUpdates.add(champGymId)
        }
      }

      // Award the national amateur title to the champion.
      champion.competition.amateur.titles.push({
        circuitLevel: event.circuitLevel,
        weightClassId,
        wonYear: state.year,
        wonWeek: state.week,
        eventId: event.id,
      })
      state.pendingFighterUpdates.add(champion.id)
    }
  }

  event.status = 'completed'
  return boutsResolved
}

// runEventTick processes all calendar events scheduled for the current week.
// Returns the total number of bouts resolved across all events.
export function runEventTick(state: AdvanceWeekState, data: GameData, rng: RNG): number {
  const thisWeekEvents = state.calendar.filter(
    e => e.year === state.year && e.week === state.week && e.status === 'scheduled',
  )

  let totalBouts = 0

  for (const event of thisWeekEvents) {
    if (event.circuitLevel === 'club_card') {
      totalBouts += resolveClubCard(event, state, data, rng)
    } else if (
      event.circuitLevel === 'regional_tournament' ||
      event.circuitLevel === 'national_championship' ||
      event.circuitLevel === 'golden_gloves'
    ) {
      totalBouts += resolveTournament(event, state, data, rng)
    }
    // Pro cards and international events are not resolved in the backrun —
    // the pro ecosystem develops organically from amateur results over time.
  }

  return totalBouts
}
