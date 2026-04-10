// styleEngine provides lookup helpers for the fight simulation.
// The exchange simulation calls these to get the relevant matchup
// and calculate effective modifiers for a specific pair of fighters.

import type { StyleMatchup } from '../types/data/style.js'
import type { StyleTendencyId } from '../types/data/style.js'
import type { GameData } from '../data/loader.js'

// getMatchup returns the relevant StyleMatchup for two fighter styles.
// If both styles are the same — returns mirror_match_generic.
// If either style is undefined — returns undefined_vs_any.
// Otherwise finds the matchup by matching both style ids regardless of order.
export function getMatchup(
  styleA: StyleTendencyId,
  styleB: StyleTendencyId,
  data: GameData,
): StyleMatchup {
  // Either fighter lacking a formed style means no style system is in play.
  // Pure attribute fight — undefined_vs_any is the correct matchup for this.
  if (styleA === 'undefined' || styleB === 'undefined') {
    const matchup = data.styleMatchups.matchups.find(m => m.id === 'undefined_vs_any')
    if (matchup === undefined) throw new Error('Missing required matchup: undefined_vs_any')
    return matchup
  }

  // Mirror match: same style vs same style — style advantage cancels out.
  // boxer_vs_boxer is a specific entry but mirror_match_generic covers all other pairings.
  if (styleA === styleB) {
    // boxer_vs_boxer has its own entry with specific modifiers — use it when available.
    const specific = data.styleMatchups.matchups.find(m =>
      m.styles.length === 2 && m.styles.includes(styleA) && m.styles.includes(styleB),
    )
    if (specific !== undefined) return specific

    const mirror = data.styleMatchups.matchups.find(m => m.id === 'mirror_match_generic')
    if (mirror === undefined) throw new Error('Missing required matchup: mirror_match_generic')
    return mirror
  }

  // Find a matchup that references both styles, regardless of which is styleA or styleB.
  // Matchup ids are canonical (e.g. pressure_vs_boxer) but the lookup must be order-agnostic
  // because either fighter can be passed as styleA.
  const matchup = data.styleMatchups.matchups.find(m =>
    m.styles.includes(styleA) && m.styles.includes(styleB),
  )

  if (matchup === undefined) {
    // No specific matchup for this style pairing — fall back to the generic mirror match.
    // This handles style combinations that exist in practice but were not explicitly tuned.
    // mirror_match_generic produces a neutral fight with no style-based advantage.
    const fallback = data.styleMatchups.matchups.find(m => m.id === 'mirror_match_generic')
    if (fallback === undefined) throw new Error('Missing required matchup: mirror_match_generic')
    return fallback
  }

  return matchup
}

// getEffectiveModifiers returns the matchup modifiers scaled by both fighters'
// tendency strength and style effectiveness.
// effectiveModifier = baseModifier × styleEffectivenessA × styleEffectivenessB
// This is what the exchange simulation actually uses.
export function getEffectiveModifiers(
  matchup: StyleMatchup,
  effectivenessA: number,
  effectivenessB: number,
): Record<string, number> {
  // Both fighters must express their style for modifiers to apply at full strength.
  // If either fighter's style is unexpressed (effectiveness 0), modifiers collapse to zero —
  // which is correct: an undefined-style fight should have no style modifiers at all.
  const result: Record<string, number> = {}
  for (const [key, value] of Object.entries(matchup.modifiers)) {
    result[key] = value * effectivenessA * effectivenessB
  }
  return result
}
