// Gym is the physical space, business, community, and reputation.
// Everything in Corner Gym connects to a gym.
// The player's gym is marked isPlayerGym: true.
// Rival gyms run on the same data structure and engine logic.
//
// Capacity rule: maxTrainingCapacity = floor(trainingFloorSquareMeters / 4)
// This is the maximum number of people training simultaneously.
// lockerCount is a separate cap on total membership (people who hold a membership
// regardless of whether they are training at this moment).
// Both constraints are enforced — you can have 100 members but only
// floor(trainingFloor.squareMeters / 4) training at any one time.

export type GymTier =
  | 'community'     // mostly regulars, small competitor percentage
  | 'development'   // balanced, growing reputation
  | 'competition'   // majority competitors, known locally
  | 'elite'         // almost entirely competitors, nationally known
// GymTier is derived by the engine from roster composition and reputation.
// Never set directly — it is always calculated.

export interface GymZone {
  exists: boolean
  condition: number     // 0-100. 0 = unusable. Decays over time without maintenance.
  squareMeters: number
}

export interface GymZones {
  trainingFloor: GymZone
  strengthRoom: GymZone
  changingRooms: GymZone
  reception: GymZone
  storage?: GymZone
  videoAnalysisRoom?: GymZone
}

export interface GymEquipmentItem {
  id: string            // unique instance id — multiple heavy bags each have their own id
  typeId: string        // references gym-equipment-types.json
  condition: number     // 0-100
  purchasedYear: number
  purchasedWeek: number
  lastMaintenanceYear: number | null
  lastMaintenanceWeek: number | null
  inUse: boolean        // false if broken or in storage
}

export interface GymEquipmentOrder {
  // Equipment ordered but not yet arrived — shown in inbox as pending
  id: string
  typeId: string
  quantity: number
  orderedYear: number
  orderedWeek: number
  estimatedArrivalYear: number
  estimatedArrivalWeek: number
  cost: number
}

export type StaffRole =
  | 'head_coach'
  | 'secondary_coach'
  | 'fitness_coach'
  | 'kids_coach'
  | 'maintenance'
  | 'admin'

export interface GymStaffMember {
  personId: string
  role: StaffRole
  startedYear: number
  startedWeek: number
  wageMonthly: number
  isGymMemberFilling: boolean
  // true = a gym member filling the role informally, not a hired professional.
  // Gym members filling roles have a quality ceiling and produce lower training gains.
  // The engine derives their quality from their Person attributes + coaching-relevant traits.
}

export interface GymRevenueRecord {
  year: number
  week: number
  income: number
  outgoings: number
  balance: number
  note: string    // what drove this week's change — surfaces in monthly financial report
}

export interface GymFinances {
  monthlyRent: number
  balance: number
  loanAmount: number
  loanRepaymentMonthly: number
  membershipFeeMonthly: number
  lastUpdatedYear: number
  lastUpdatedWeek: number
  revenueHistory: GymRevenueRecord[]
}

export interface GymQuality {
  // Derived composite quality scores. Never stored statically —
  // recalculated by the engine after any equipment condition change or zone change.
  // Cached here to avoid recalculating every single week unnecessarily.
  trainingFloor: number     // 0-100
  strengthRoom: number      // 0-100
  changingRooms: number     // 0-100
  reception: number         // 0-100
  overall: number           // weighted composite: training 50%, strength 20%, changing 10%, reception 10%, other 10%
  hasRing: boolean          // ring absence hard-caps ring_generalship, footwork, lateral_movement gains
  ringCount: number         // 0, 1, or 2
  maxTrainingCapacity: number  // floor(trainingFloor.squareMeters / 4)
  lastCalculatedYear: number
  lastCalculatedWeek: number
}

export interface GymExpansion {
  // Active building expansion — null when no expansion is underway.
  // Expansions take real time and disrupt training during construction.
  id: string
  description: string
  squareMetersAdded: number
  newZoneId?: string         // if a new zone is being created
  startedYear: number
  startedWeek: number
  completionYear: number
  completionWeek: number
  cost: number
  disruptionWeeksRemaining: number
  // Training quality is reduced during construction — fighters notice the noise and disruption.
}

export interface KidsCohortRecord {
  year: number
  enrolmentCount: number
  instructorQuality: number     // quality of instructor that year — affects output
  potentialProspectsCount: number  // how many showed genuine potential
  prospectPersonIds: string[]   // pre-seeded in city talent pool
}

export interface GymKidsClass {
  // Kids classes are a revenue stream and talent pipeline.
  // They run in off-peak hours and do not compete with main training capacity.
  // The yearly cohort review surfaces any child who showed genuine potential.
  // Those children are pre-seeded in the city talent pool — they may appear
  // at your door when they come of age.
  active: boolean
  instructorPersonId: string | null
  // null = head coach doubles up (lower cohort quality, head coach is stretched)
  // Should ideally be a dedicated kids_coach staff member for best results.
  monthlyFee: number
  currentEnrolment: number
  maxEnrolment: number       // derived from off-peak training floor capacity
  cohortHistory: KidsCohortRecord[]
}

export interface GymCulture {
  // The identity of the gym as felt by everyone who trains here.
  // Derived from the owner, the coach, and the fighters — never set directly.
  // Changes gradually through events: wins, losses, incidents, coaching changes.
  atmosphereScore: number       // 0-100. How the gym feels to be in.
  sparringIntensity: number     // 0-100. How hard people go in sparring.
  // High intensity: tougher fighters, better mental attributes, accelerated health wear.
  // Low intensity: safer, slower development, less grit.
  memberCohesion: number        // 0-100. Family vs broken unit.
  coachingFocus: string | null  // emerges from head coach emphasis — null until established
  reputationTone: string | null
  // What outsiders say about this gym. Emerges after sufficient history.
  // Examples: 'tough', 'technical', 'welcoming', 'elite', 'old school'
  // Derived by engine from atmosphereScore, sparringIntensity, coachingFocus, reputation.
}

export interface GymAccomplishment {
  type: 'amateur_title' | 'pro_title' | 'medal' | 'milestone'
  label: string
  year: number
  fighterId: string
  description: string
}

export interface GymReputation {
  local: number         // 0-100
  regional: number      // 0-100
  national: number      // 0-100
  international: number // 0-100
}

export interface Gym {
  id: string
  name: string
  cityId: string
  nationId: string
  isPlayerGym: boolean
  foundedYear: number
  foundedWeek: number

  // Physical space
  totalSquareMeters: number
  zones: GymZones
  equipment: GymEquipmentItem[]
  pendingOrders: GymEquipmentOrder[]
  activeExpansion: GymExpansion | null

  // People
  staffMembers: GymStaffMember[]
  memberIds: string[]       // all Person ids who train here (regulars, atmosphere, competitors)
  fighterIds: string[]      // subset of memberIds who are Fighters

  // Business
  finances: GymFinances
  lockerCount: number       // max total membership — separate from training capacity
  kidsClass: GymKidsClass

  // Quality and identity
  quality: GymQuality       // derived, cached, recalculated after changes
  gymTier: GymTier          // derived from roster and reputation — never set directly
  culture: GymCulture
  reputation: GymReputation
  accomplishments: GymAccomplishment[]
}
