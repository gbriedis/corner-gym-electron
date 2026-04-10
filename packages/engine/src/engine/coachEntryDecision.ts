// coachEntryDecision determines whether a coach enters a fighter
// into a specific event. Used by the backrun and eventually by
// live play when the player delegates decisions.
//
// For the backrun, this is intentionally simple — the full coaching
// AI that live play uses will build on this foundation.
//
// Decision factors:
// - Fighter registration status (unregistered fighters cannot enter)
// - Fighter identity state (must be aspiring or competing)
// - Inactivity (fighters idle 2+ years need conditioning first)
// - Readiness threshold (coach quality affects the threshold)
// - Circuit level appropriateness (raw beginners don't enter nationals)

import type { Fighter } from '../types/fighter.js'
import type { CalendarEvent } from '../types/calendar.js'
import type { Coach } from '../types/coach.js'

// Calculate total weeks elapsed between two year/week positions.
// Used to measure inactivity gaps between bouts.
function calculateWeeksSince(
  pastYear: number,
  pastWeek: number,
  currentYear: number,
  currentWeek: number,
): number {
  return (currentYear - pastYear) * 52 + (currentWeek - pastWeek)
}

// Coach quality maps to readiness thresholds.
// Poor coaches enter fighters early — they prioritise learning over polish.
// Elite coaches wait until the fighter is genuinely ready — they protect development.
function coachReadinessThreshold(coach: Coach | null): number {
  if (coach === null) return 35   // gym member filling role — middle ground
  if (coach.quality <= 5)  return 30   // poor: desperate for experience
  if (coach.quality <= 10) return 45   // average
  if (coach.quality <= 15) return 55   // good
  return 65                            // elite (16-20)
}

// Minimum amateur bouts required to enter a given circuit level.
// Club cards are open — any registered fighter can enter.
// Higher levels require demonstrated competition experience.
function minimumBoutsForCircuit(circuitLevel: string): number {
  if (circuitLevel === 'regional_tournament') return 1
  if (circuitLevel === 'national_championship') return 3
  if (circuitLevel === 'golden_gloves') return 3
  return 0  // club_card and unknown levels are open
}

function totalAmateurBouts(fighter: Fighter): number {
  return fighter.competition.amateur.wins + fighter.competition.amateur.losses
}

// coachShouldEnterFighter returns true when all entry conditions are met.
// currentYear and currentWeek are the simulation's current position —
// needed to calculate inactivity gaps from fighter.career.lastBoutYear/Week.
export function coachShouldEnterFighter(
  fighter: Fighter,
  event: CalendarEvent,
  coach: Coach | null,
  currentYear: number,
  currentWeek: number,
): boolean {
  // Unregistered fighters cannot compete in any official sanctioned event
  if (fighter.competition.status === 'unregistered') return false

  // Fighter must have decided they want to compete — unaware and curious
  // have not made that commitment yet; retired have made their final one
  const { state } = fighter.fighterIdentity
  if (state !== 'aspiring' && state !== 'competing') return false

  // Recovery and inactivity checks — fighters need time between bouts.
  // Real amateur fighters compete every 6-12 weeks at most; entering every
  // event produces unrealistically inflated bout counts.
  if (fighter.career.lastBoutYear !== null && fighter.career.lastBoutWeek !== null) {
    const weeksSinceLastBout = calculateWeeksSince(
      fighter.career.lastBoutYear,
      fighter.career.lastBoutWeek,
      currentYear,
      currentWeek,
    )

    // Minimum recovery between event entries scales with career experience.
    // Tournament entries generate multiple bouts per event (rounds), so veterans
    // who appear in every event quickly accumulate unrealistic bout totals.
    // Increasing the gap for veterans brings career bout counts to realistic ranges.
    const bouts = totalAmateurBouts(fighter)
    const minWeeksBetweenBouts = bouts > 30 ? 26 : bouts > 10 ? 14 : 8
    if (weeksSinceLastBout < minWeeksBetweenBouts) return false

    // Long inactivity: 2+ years without a bout means the fighter is de-trained
    // and needs reconditioning before returning to competition
    if (weeksSinceLastBout > 104) return false
  }

  // Readiness threshold — coaches protect their fighters from premature entry
  const threshold = coachReadinessThreshold(coach)
  if (fighter.career.readiness < threshold) return false

  // Circuit level appropriateness — prevent raw beginners from entering
  // national championships they have no business being in
  const minimumBouts = minimumBoutsForCircuit(event.circuitLevel)
  if (totalAmateurBouts(fighter) < minimumBouts) return false

  return true
}
