// Matches nations/latvia/names.json and nations/usa/names.json.
// Latvia uses a flat male name pool. USA uses byEthnicity pools.
import type { Meta } from './meta.js'

export interface MaleNames {
  firstNames: string[]
  surnames: string[]
}

export interface EthnicityNames {
  male: MaleNames
}

export interface NamesData {
  meta: Meta
  nation: string
  // Latvia: flat pool used when no ethnicity is assigned.
  male?: MaleNames
  // USA: per-ethnicity pools. Engine uses ethnicityId to select the right pool.
  byEthnicity?: Record<string, EthnicityNames>
}
