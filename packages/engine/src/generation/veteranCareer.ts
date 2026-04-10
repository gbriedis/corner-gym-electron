// generateVeteranCareer produces a plausible career record for a fighter
// who has been competing before world generation starts.
// Not simulated — statistically generated based on attributes and years active.
// Called from world generation when age >= 29 and identity state is competing or retired.
//
// After applying the career record to the fighter, mental attributes are updated
// to reflect competitive experience — a fighter with 50 amateur bouts has earned
// composure that a first-timer has not.

import type { Fighter } from '../types/fighter.js'
import type { GameData } from '../data/loader.js'
import type { RNG } from '../utils/rng.js'

export interface VeteranCareerRecord {
  amateurWins: number
  amateurLosses: number
  peakCircuitLevel: string
  totalBouts: number
}

// calculateOverallScore derives a 0-1 quality score from the fighter's developed attributes.
// Higher scores map to better win rates and higher circuit achievement.
function calculateOverallScore(fighter: Fighter): number {
  if (fighter.developedAttributes.length === 0) return 0.5
  const sum = fighter.developedAttributes.reduce((acc, a) => acc + a.current, 0)
  // Normalise from 1-20 scale to 0-1
  return Math.max(0, Math.min(1, (sum / fighter.developedAttributes.length - 1) / 19))
}

// derivePeakCircuit maps win rate and total bouts to the highest circuit level a veteran reached.
// Strong record with many bouts → national level.
// Moderate record → regional.
// Weak record or few bouts → club level only.
function derivePeakCircuit(wins: number, losses: number, attributeScore: number, rng: RNG): string {
  const total = wins + losses
  if (total === 0) return 'club_card'

  const winRate = wins / total

  // National level: strong win rate, decent experience, good attributes
  if (winRate >= 0.65 && total >= 15 && attributeScore >= 0.45 && rng.next() < 0.40) {
    return 'national_championship'
  }
  // Regional level: decent win rate, some experience
  if (winRate >= 0.50 && total >= 8 && attributeScore >= 0.30) {
    return 'regional_tournament'
  }
  return 'club_card'
}

// generateVeteranCareer assigns a statistical career history to the fighter in place.
// Mutates the fighter's competition record and developed attributes.
export function generateVeteranCareer(fighter: Fighter, data: GameData, rng: RNG): void {
  const attributeScore = calculateOverallScore(fighter)

  // Years active: from first competed age (~18-20 typical) to current age.
  // Clamped so a 29-year-old who started late has fewer active years than a 40-year-old.
  const firstCompetedAge = Math.max(16, Math.min(22, 20 - Math.round(attributeScore * 4)))
  const yearsActive = Math.max(1, fighter.age - firstCompetedAge)

  // Bouts per year: 3-8, inversely correlated with age (older fighters compete less).
  // Veterans in their 30s entered fewer events per year than when they were young.
  const maxBoutsPerYear = fighter.age >= 35 ? 5 : 8
  const boutsPerYear = rng.nextInt(3, maxBoutsPerYear)
  const totalBouts = Math.round(yearsActive * boutsPerYear * (rng.next() * 0.3 + 0.7))

  if (totalBouts === 0) return

  // Win rate based on attribute quality:
  // High attributes → 60-75% win rate
  // Average → 45-60%
  // Low → 30-50%
  const winRateBase = 0.30 + attributeScore * 0.45
  const winRate = Math.max(0.20, Math.min(0.85, winRateBase + (rng.next() - 0.5) * 0.15))

  const wins = Math.round(totalBouts * winRate)
  const losses = totalBouts - wins

  const peakCircuitLevel = derivePeakCircuit(wins, losses, attributeScore, rng)

  // Apply career record to fighter
  fighter.competition.amateur.wins = wins
  fighter.competition.amateur.losses = losses
  fighter.competition.amateur.currentLosingStreak = 0

  // If fighter is still competing, set a plausible last bout time.
  // Retired fighters had their last bout 1-4 years ago.
  // This is set as null here — the backrun will establish real bout timing.
  // The lastBoutYear/Week will remain null until actual bouts resolve.

  // Update career identity: a veteran with real bouts should be registered
  if (fighter.competition.status === 'unregistered') {
    fighter.competition.status = 'amateur'
  }

  // Update mental attributes to reflect competitive experience.
  // A veteran with many bouts has earned ring_iq and composure that a newcomer hasn't.
  // Use the mental attribute caps from attribute-accumulation.json, keyed on bout count.
  const mentalCap = data.attributeAccumulation.startingValueFormula.mentalAttributeStartingCap
  const mentalIds = new Set(['ring_iq', 'composure', 'adaptability', 'heart', 'big_fight_experience'])

  const cap = totalBouts === 0 ? mentalCap.noBouts
    : totalBouts <= 5 ? mentalCap.fewBouts_1_to_5
    : totalBouts <= 20 ? mentalCap.experienced_6_to_20
    : mentalCap.veteran_21_plus

  for (const attr of fighter.developedAttributes) {
    if (!mentalIds.has(attr.attributeId)) continue

    // Scale mental attributes to the cap based on bout count and win rate.
    // A veteran with 40 bouts and a strong record should be near the cap.
    const experienceFactor = Math.min(1.0, totalBouts / 30) * (0.5 + winRate * 0.5)
    const boosted = Math.round(cap * experienceFactor)

    // Only boost — never reduce already-high values.
    if (boosted > attr.current) {
      attr.current = Math.min(cap, Math.max(attr.current, boosted))
    }
  }

  // Store peak circuit on the fighter identity for coach quality derivation.
  // Use the peakCircuitLevel as a proxy for prestige.
  fighter.career.peakCircuitLevel = peakCircuitLevel
}
