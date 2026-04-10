// Coach — a Person who develops fighters.
// Every coach was either a former fighter who transitioned into coaching,
// or a specialist who never competed but built expertise through study and experience.
//
// A coach's style is NOT their fighting style — it is how they teach.
// A former pressure fighter may become a technical coach if their soul traits
// drive them to study what they lacked as a fighter. The connection between
// fighting background and coaching emphasis is a starting tendency, not a rule.
//
// Quality grows toward qualityPotential over years of coaching experience.
// styleCertainty grows as the coach develops a clear identity over time.

export interface CoachStyle {
  emphasis: 'technical' | 'pressure' | 'physical' | 'defensive' | 'balanced'
  methodology: 'disciplined' | 'freestyle' | 'structured'
  communicationStyle: 'demanding' | 'supportive' | 'detached'
}

export interface CoachFighterRelationship {
  fighterId: string
  trustScore: number            // 0-100. Starts from trait compatibility. Grows with time and results.
  weeksWorkedTogether: number
  lastConflictYear: number | null
  lastConflictWeek: number | null
  note: string | null           // player-added observations — same ocean rule as fighter knowledge
}

export interface Coach {
  id: string
  personId: string              // references the Person this coach is
  gymId: string
  role: 'head_coach' | 'secondary_coach' | 'fitness_coach' | 'kids_coach'

  // Quality — how effective they are at developing fighters
  quality: number               // 1-20. Current coaching quality.
  qualityPotential: number      // 1-20. The ceiling quality can reach. Former elite fighters have higher ceiling.
  weeksCoaching: number         // total coaching experience — quality grows toward potential as this increases

  // Style — how they teach (NOT their former fighting style)
  style: CoachStyle             // emphasis, methodology, communicationStyle
  styleCertainty: number        // 0-100. How defined their coaching identity is. Low = still finding their way.

  // Background
  formerFighter: boolean
  careerPeakCircuitLevel: string | null   // null for specialists
  careerPeakPrestige: number              // 0-7, from circuit level prestige

  // Relationships — stored on coach, cross-referenced from Fighter
  fighterRelationships: CoachFighterRelationship[]
}
