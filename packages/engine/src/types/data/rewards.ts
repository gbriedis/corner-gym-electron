// Matches data/universal/rewards.json
import type { Meta } from './meta.js'
import type { CircuitLevel } from './boxing.js'

export type MedalType = 'gold' | 'silver' | 'bronze'

export interface RewardResult {
  fighterRep: number
  gymRep: number
  followers: number
  medal: MedalType | null
  belt: string | null
  description: string
}

// Club-level events use win/loss results.
export interface ClubRewards {
  win: RewardResult
  loss: RewardResult
}

// Tournament events use gold/silver/bronze results.
export interface TournamentRewards {
  gold: RewardResult
  silver: RewardResult
  bronze: RewardResult
}

export interface CircuitReward {
  circuitLevel: CircuitLevel
  results: ClubRewards | TournamentRewards
}

export interface RewardsData {
  meta: Meta
  circuitRewards: CircuitReward[]
}
