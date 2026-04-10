// Coach stub — full implementation when staff system is built.
// A coach is a Person with a coaching role and a defined style.
// Fighter references coachId — this type makes that reference valid.

export interface CoachStyle {
  emphasis: 'technical' | 'pressure' | 'physical' | 'defensive' | 'balanced'
  methodology: 'disciplined' | 'freestyle' | 'structured'
  communicationStyle: 'demanding' | 'supportive' | 'detached'
}

export interface Coach {
  id: string
  personId: string   // references Person — coach is a person first
  gymId: string
  quality: number    // 1-20
  style: CoachStyle
  // Full coach fields added when staff system is built
}
