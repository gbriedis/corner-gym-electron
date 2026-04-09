// Bracket — single elimination bracket component.
// Renders round columns left to right with SVG connector lines between rounds.
// Scales by round count: 1=final only, 2=semis+final, 3=quarters+semis+final, 4=R16+...
// Empty bracket (no entrants) shows TBD slots — structure still shows correctly.

import type { JSX } from 'react'
import type { TournamentEntrant } from '@corner-gym/engine'

export interface BracketProps {
  rounds: number                   // 1=final only, 2=semis+final, 3=quarters+semis+final
  entrants?: TournamentEntrant[]   // empty or undefined = all TBD slots
  winnerId?: string
}

// Layout constants.
const SLOT_W = 180    // slot width px
const SLOT_H = 44     // slot height px
const SLOT_G = 8      // gap between adjacent slots in same round
const COL_G  = 32     // connector column width between rounds

// Round column headers, indexed from the final back to the first round.
// Index 0 = FINAL, 1 = SEMIFINALS, 2 = QUARTERFINALS, 3 = ROUND OF 16.
const ROUND_LABEL_BY_DISTANCE_FROM_FINAL = [
  'FINAL',
  'SEMIFINALS',
  'QUARTERFINALS',
  'ROUND OF 16',
]

// getSlotCenterY — vertical centre of a slot given its position and round.
// Slots in later rounds span multiple "bands" (leaf slot rows) — their centre
// is the midpoint of the first and last leaf slot centres they span.
function getSlotCenterY(slotIdx: number, roundIdx: number): number {
  const bandsPerSlot = Math.pow(2, roundIdx)
  const firstLeaf    = slotIdx * bandsPerSlot
  const lastLeaf     = firstLeaf + bandsPerSlot - 1
  const firstCenter  = firstLeaf * (SLOT_H + SLOT_G) + SLOT_H / 2
  const lastCenter   = lastLeaf  * (SLOT_H + SLOT_G) + SLOT_H / 2
  return (firstCenter + lastCenter) / 2
}

// getRoundLabels — left-to-right labels for each round column.
// First column (most slots) gets the label farthest from the final.
function getRoundLabels(totalRounds: number): string[] {
  const labels: string[] = []
  for (let r = 0; r < totalRounds; r++) {
    const distanceFromFinal = totalRounds - 1 - r
    labels.push(ROUND_LABEL_BY_DISTANCE_FROM_FINAL[distanceFromFinal] ?? `ROUND ${distanceFromFinal + 1}`)
  }
  return labels
}

export default function Bracket({ rounds, entrants, winnerId }: BracketProps): JSX.Element {
  const firstRoundSlots = Math.pow(2, rounds - 1)
  const totalHeight     = firstRoundSlots * SLOT_H + (firstRoundSlots - 1) * SLOT_G
  const totalWidth      = rounds * SLOT_W + (rounds - 1) * COL_G
  const roundLabels     = getRoundLabels(rounds)

  // Pre-compute all slots across all rounds for clean rendering.
  const allSlots: Array<{
    roundIdx:  number
    slotIdx:   number
    topY:      number
    colX:      number
    entrant:   TournamentEntrant | null
    isWinner:  boolean
  }> = []

  for (let r = 0; r < rounds; r++) {
    const slotsInRound = Math.pow(2, rounds - 1 - r)
    const colX         = r * (SLOT_W + COL_G)
    for (let i = 0; i < slotsInRound; i++) {
      const centerY  = getSlotCenterY(i, r)
      const topY     = centerY - SLOT_H / 2
      // Only populate first-round slots from the entrants list.
      // Later rounds are TBD until the engine runs the bracket.
      const entrant  = r === 0 ? (entrants?.[i] ?? null) : null
      const isWinner = winnerId !== undefined && entrant !== null && entrant.fighterId === winnerId
      allSlots.push({ roundIdx: r, slotIdx: i, topY, colX, entrant, isWinner })
    }
  }

  // SVG connector data for each pair of adjacent rounds.
  const connectors: Array<{
    roundIdx:   number  // left round index
    svgX:       number
    pairs: Array<{ y1: number; y2: number; y3: number }>
  }> = []

  for (let r = 0; r < rounds - 1; r++) {
    const svgX          = r * (SLOT_W + COL_G) + SLOT_W
    const slotsInNext   = Math.pow(2, rounds - 2 - r)
    const pairs: Array<{ y1: number; y2: number; y3: number }> = []
    for (let j = 0; j < slotsInNext; j++) {
      pairs.push({
        y1: getSlotCenterY(2 * j,     r),
        y2: getSlotCenterY(2 * j + 1, r),
        y3: getSlotCenterY(j,          r + 1),
      })
    }
    connectors.push({ roundIdx: r, svgX, pairs })
  }

  const mutedText: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize:   '11px',
    color:      'rgba(218,212,201,0.3)',
    overflow:   'hidden',
    whiteSpace: 'nowrap' as const,
    textOverflow: 'ellipsis',
  }
  const primaryText: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize:   '11px',
    color:      'var(--color-text-primary)',
    overflow:   'hidden',
    whiteSpace: 'nowrap' as const,
    textOverflow: 'ellipsis',
  }
  const secondaryText: React.CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize:   '10px',
    color:      'rgba(218,212,201,0.35)',
    overflow:   'hidden',
    whiteSpace: 'nowrap' as const,
    textOverflow: 'ellipsis',
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Round labels above each column */}
      <div style={{ display: 'flex', width: `${totalWidth}px`, marginBottom: '8px' }}>
        {roundLabels.map((label, r) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div
              style={{
                width: `${SLOT_W}px`,
                fontFamily: 'var(--font-body)',
                fontSize: '9px',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'rgba(218,212,201,0.35)',
                textAlign: 'center',
              }}
            >
              {label}
            </div>
            {r < rounds - 1 && <div style={{ width: `${COL_G}px` }} />}
          </div>
        ))}
      </div>

      {/* Bracket body — slots and connector SVGs absolutely positioned */}
      <div style={{ position: 'relative', width: `${totalWidth}px`, height: `${totalHeight}px` }}>
        {/* Slot divs */}
        {allSlots.map(({ roundIdx, slotIdx, topY, colX, entrant, isWinner }) => (
          <div
            key={`slot-${roundIdx}-${slotIdx}`}
            style={{
              position:       'absolute',
              left:           `${colX}px`,
              top:            `${topY}px`,
              width:          `${SLOT_W}px`,
              height:         `${SLOT_H}px`,
              backgroundColor: 'var(--color-bg-mid)',
              border:          isWinner
                ? '1px solid var(--color-accent-amber)'
                : '1px solid rgba(218,212,201,0.3)',
              display:         'flex',
              flexDirection:   'column',
              justifyContent:  'center',
              padding:         '0 8px',
              boxSizing:       'border-box',
              gap:             '2px',
            }}
          >
            <div style={entrant !== null ? primaryText : mutedText}>
              {entrant !== null ? entrant.fighterId : 'TBD'}
            </div>
            <div style={secondaryText}>
              {entrant !== null ? entrant.gymId : '—'}
            </div>
          </div>
        ))}

        {/* SVG connector lines — elbow bracket shape between each pair of rounds */}
        {connectors.map(({ roundIdx, svgX, pairs }) => (
          <svg
            key={`conn-${roundIdx}`}
            style={{ position: 'absolute', left: `${svgX}px`, top: 0, overflow: 'visible' }}
            width={COL_G}
            height={totalHeight}
          >
            {pairs.map(({ y1, y2, y3 }, j) => (
              // Path draws both input arms + the vertical connector + the output arm.
              // M 0 y1 H mx: horizontal arm from left slot to midpoint for top child.
              // V y2: vertical line spanning from top child centre to bottom child centre.
              // H 0: horizontal arm back to the left edge for bottom child.
              // M mx y3 H COL_G: output arm from midpoint to right slot.
              // y3 is always (y1+y2)/2 by construction — the vertical midpoint.
              <path
                key={j}
                d={`M 0 ${y1} H ${COL_G / 2} V ${y2} H 0 M ${COL_G / 2} ${y3} H ${COL_G}`}
                fill="none"
                stroke="var(--color-bg-mid)"
                strokeWidth={1}
              />
            ))}
          </svg>
        ))}
      </div>
    </div>
  )
}
