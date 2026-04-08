// generateBracket produces an empty TournamentBracket from a list of entrants.
// Brackets are generated when an event week arrives and entry is closed —
// not at calendar creation time. The bracket contains fighter assignments
// but no results — the fight engine fills results when the event runs.
//
// Bracket sizing rules:
// - 2 entrants: 1 round (final only)
// - 3-4 entrants: 2 rounds (semis + final)
// - 5-8 entrants: 3 rounds (quarters + semis + final)
// - 9-16 entrants: 4 rounds
// Byes are assigned to lower seeds when entrant count is not a power of 2.
//
// Seeding: if entrants have seed values, higher seeds avoid each other
// until the final. Unseeded entrants are randomly distributed.

import type {
  TournamentBracket,
  TournamentEntrant,
  TournamentRound,
  Bout,
} from '../types/competition.js'
import type { RNG } from '../utils/rng.js'

// Returns the smallest power of 2 >= n.
// Brackets must be powers of 2 so every round halves the field evenly — no
// round would have an odd number of bouts, which would require bye logic in
// the middle of a tournament rather than only at the entry round.
function nextPowerOf2(n: number): number {
  if (n <= 1) return 1
  let p = 1
  while (p < n) p *= 2
  return p
}

// buildSeedPositions returns the seed number for each bracket slot at a given size.
// Recursively splits the bracket so complementary seeds (1 and n, 2 and n-1, ...)
// are always on opposite halves — guaranteeing that the top two seeds can only
// meet in the final, seeds 1-4 can only meet in the semis or later, and so on.
// This is the standard single-elimination seeding algorithm.
function buildSeedPositions(n: number): number[] {
  if (n === 1) return [1]
  const half = buildSeedPositions(n / 2)
  const result: number[] = []
  for (const s of half) {
    result.push(s)
    result.push(n + 1 - s)
  }
  return result
}

// deterministic boutId — same event + weight class + age category + round + index
// always produces the same id. This allows brackets to be reconstructed from
// their parameters without needing to persist all boutIds separately.
function boutId(
  eventId: string,
  weightClassId: string,
  ageCategoryId: string,
  roundNumber: number,
  boutIndex: number,
): string {
  return `${eventId}-${weightClassId}-${ageCategoryId}-r${roundNumber}-b${boutIndex}`
}

interface EntrantPair {
  fighterAId: string
  fighterBId: string
  gymAId: string
  gymBId: string
}

export function generateBracket(
  eventId: string,
  weightClassId: string,
  ageCategoryId: string,
  circuitLevel: string,
  scheduledRounds: number,
  entrants: TournamentEntrant[],
  daysStructure: { day: number; label: string; roundNumber: number }[],
  rng: RNG,
): { bracket: TournamentBracket; bouts: Bout[] } {
  if (entrants.length < 2) {
    throw new Error(
      `generateBracket requires at least 2 entrants, got ${entrants.length}`,
    )
  }

  const bracketSize = nextPowerOf2(entrants.length)
  const numRounds = Math.log2(bracketSize)

  // Assign seeds to any entrants that don't have one by shuffling them into
  // remaining seed slots. Seeded fighters retain their position; unseeded
  // fighters are distributed randomly into the remaining slots.
  const seededEntrants: (TournamentEntrant | null)[] = new Array(bracketSize).fill(null)
  const unseeded: TournamentEntrant[] = []

  for (const e of entrants) {
    if (e.seed !== undefined && e.seed >= 1 && e.seed <= bracketSize) {
      seededEntrants[e.seed - 1] = e
    } else {
      unseeded.push(e)
    }
  }

  // Fill empty slots with unseeded entrants in random order.
  const shuffled = [...unseeded]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i)
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }
  let unseededIdx = 0
  for (let i = 0; i < bracketSize; i++) {
    if (seededEntrants[i] === null && unseededIdx < shuffled.length) {
      seededEntrants[i] = shuffled[unseededIdx++]
    }
  }

  // Map seed numbers to bracket positions using the standard seeding layout.
  // Slot at position i holds the entrant with seed seedPositions[i].
  // Slots with seed > entrants.length are bye positions.
  const seedPositions = buildSeedPositions(bracketSize)
  const bracketSlots: (TournamentEntrant | 'bye')[] = seedPositions.map(seed => {
    if (seed > entrants.length) return 'bye'
    const entrant = seededEntrants[seed - 1]
    // Byes go to the slot positions that would hold lower seeds (those beyond
    // the actual entrant count). Top seeds inherit free advancement because their
    // bracket slot happens to face a bye position rather than a real opponent.
    // This is standard seeding behaviour: byes fill the "missing" low-seed slots.
    return entrant ?? 'bye'
  })

  // Build round 1 bouts by pairing adjacent bracket slots.
  const round1Pairs: EntrantPair[] = []
  for (let i = 0; i < bracketSize; i += 2) {
    const a = bracketSlots[i]
    const b = bracketSlots[i + 1]
    round1Pairs.push({
      fighterAId: a === 'bye' ? 'bye' : a.fighterId,
      fighterBId: b === 'bye' ? 'bye' : b.fighterId,
      gymAId:     a === 'bye' ? 'bye' : a.gymId,
      gymBId:     b === 'bye' ? 'bye' : b.gymId,
    })
  }

  // Create Bout objects for round 1. Later rounds' Bout objects are created by
  // the fight engine as results arrive — their boutIds are pre-determined by the
  // deterministic formula, but the fighter assignments are unknown until round 1 completes.
  const round1Bouts: Bout[] = round1Pairs.map((pair, idx) => ({
    id: boutId(eventId, weightClassId, ageCategoryId, 1, idx),
    eventId,
    circuitLevel,
    weightClassId,
    ageCategoryId,
    fighterAId: pair.fighterAId,
    fighterBId: pair.fighterBId,
    gymAId: pair.gymAId,
    gymBId: pair.gymBId,
    scheduledRounds,
    status: 'scheduled' as const,
  }))

  // Build rounds. daysStructure maps tournament days to rounds.
  // Alignment is from the end: the final is always the last daysStructure entry,
  // the semis are second to last, and so on. A 4-person bracket (2 rounds) in a
  // 3-day tournament skips quarterfinals and goes straight to semis on day 2 and
  // finals on day 3. This ensures multi-day scheduling is consistent regardless
  // of bracket size.
  const rounds: TournamentRound[] = []
  const offset = daysStructure.length - numRounds

  for (let r = 1; r <= numRounds; r++) {
    const boutsInRound = bracketSize / Math.pow(2, r)
    const boutIdsInRound = Array.from({ length: boutsInRound }, (_, idx) =>
      boutId(eventId, weightClassId, ageCategoryId, r, idx),
    )

    // Align from the end of daysStructure so round 1 of a small bracket maps
    // to the day where that round actually takes place.
    const dsEntry = offset >= 0 ? daysStructure[offset + r - 1] : undefined
    const defaultLabel = r === numRounds ? 'Final' : r === numRounds - 1 ? 'Semifinals' : `Round ${r}`

    rounds.push({
      roundNumber: r,
      label: dsEntry?.label ?? defaultLabel,
      day: dsEntry?.day ?? r,
      boutIds: boutIdsInRound,
    })
  }

  const bracketId = `${eventId}-${weightClassId}-${ageCategoryId}`

  const bracket: TournamentBracket = {
    id: bracketId,
    eventId,
    weightClassId,
    ageCategoryId,
    entrants,
    rounds,
    status: 'closed',
  }

  return { bracket, bouts: round1Bouts }
}

// Exposed for testing — allows inspection of bye count without calling generateBracket.
export function countByes(entrantCount: number): number {
  return nextPowerOf2(entrantCount) - entrantCount
}
