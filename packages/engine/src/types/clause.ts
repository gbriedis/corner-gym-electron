// Clause stub — references pro-fight-offer.json clause types.
// Fighter.competition.pro.activeClauses uses this type.

export interface Clause {
  type: string   // references clauseTypes id in pro-fight-offer.json
  details: Record<string, unknown>
  expiresYear?: number
  expiresWeek?: number
}
