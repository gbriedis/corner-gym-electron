// Matches universal/weight-classes.json
import type { Meta } from './meta.js'

export interface WeightClass {
  id: string
  label: string
  // null means no upper limit (open weight class)
  limitKg: number | null
  // Only present on Super Heavyweight — omitted on all other classes
  amateurOnly?: boolean
}

export interface WeightClassesData {
  meta: Meta
  weightClasses: WeightClass[]
}
