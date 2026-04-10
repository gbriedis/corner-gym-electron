import type { Meta } from './meta.js'

export interface CoachGenerationData {
  meta: Meta
  specialistCoachProbability: number
  specialistQualityByExperience: {
    new: { qualityRange: [number, number]; potentialBonus: [number, number] }
    experienced: { qualityRange: [number, number]; potentialBonus: [number, number] }
    veteran: { qualityRange: [number, number]; potentialBonus: [number, number] }
  }
  formerFighterCoachProbability: number
  qualityGrowthPerYear: number
  styleCertaintyGrowthPerYear: number
  maximumStyleCertaintyGymMember: number
  maximumStyleCertaintyHiredCoach: number
}

export interface GymNamesData {
  meta: Meta
  patterns: {
    cityPrefix: string[]
    suffixes: string[]
    standalone: string[]
  }
  fullNames: string[]
}

export interface GymStartingTemplate {
  id: string
  label: string
  forPlayerGym: boolean
  squareMeters: { min: number; max: number }
  zones: Record<string, {
    exists: boolean
    condition: { min: number; max: number } | 0
  }>
  startingEquipment: Array<{
    typeId: string
    count: number | { min: number; max: number }
    condition: { min: number; max: number }
  }>
  finances: {
    monthlyRent: { min: number; max: number }
    startingBalance: { min: number; max: number }
    membershipFeeMonthly: { min: number; max: number }
  }
  lockerCount: { min: number; max: number }
  reputation: Record<string, { min: number; max: number } | 0>
}

export interface GymStartingStatesData {
  meta: Meta
  templates: GymStartingTemplate[]
  cityDistribution: Record<string, Record<string, number>>
}

export interface GymEquipmentTypeDefinition {
  id: string
  label: string
  zone: string
  squareMetersRequired: number
  conditionDecayPerWeek: number
  maintenanceCostMonthly: number
  purchaseCost: number
  description: string
  trainingBenefit: Record<string, string>
  requiresCoach?: boolean
}

export interface GymEquipmentTypesData {
  meta: Meta
  equipment: GymEquipmentTypeDefinition[]
}
