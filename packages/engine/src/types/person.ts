export interface SoulTraitAssignment {
  traitId: string    // references soul-traits.json id
  revealed: boolean  // has the player discovered this trait yet
}

export interface AttributeValue {
  attributeId: string // references attributes.json id
  current: number     // 1-20, changes over time
  potential: number   // 1-20, set at generation, never changes
}

export interface HealthValue {
  bodyPartId: string // references health.json id
  integrity: number  // 1-20, baseline set at generation
  damage: number     // accumulated fight damage, starts at 0
}

export interface PhysicalProfile {
  heightCm: number
  reachCm: number
  weightKg: number
  handSize: string        // band id from physical-stats.json
  neckThickness: string
  boneDensity: string
  bodyProportions: string
}

export interface GiftFlawAssignment {
  entryId: string       // references gifts-and-flaws.json id
  type: 'gift' | 'flaw'
  appliesTo: string     // attribute id
  discovered: boolean
}

export interface Person {
  id: string
  name: { first: string; surname: string }
  age: number
  nationId: string
  cityId: string
  economicStatusId: string
  reasonForBoxingId: string
  developmentProfileId: string // references development-profiles.json id
  peakAge: number              // rolled from profile's peakAgeRange at generation
  soulTraits: SoulTraitAssignment[]
  physicalProfile: PhysicalProfile
  health: HealthValue[]
  attributes: AttributeValue[]
  giftsAndFlaws: GiftFlawAssignment[]
}
