// Matches nations/latvia/names.json
import type { Meta } from './meta.js'

export interface MaleNames {
  firstNames: string[]
  surnames: string[]
}

export interface NamesData {
  meta: Meta
  nation: string
  male: MaleNames
}
