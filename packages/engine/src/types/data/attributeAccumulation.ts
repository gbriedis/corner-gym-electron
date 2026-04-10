// Matches universal/attribute-accumulation.json
// Only the startingValueFormula section is fully typed here —
// the simulation loop will add the remaining sections (eventBaseGains,
// resultModifiers, etc.) when those systems are built.

export interface MentalAttributeStartingCap {
  // Hard caps on mental attributes at generation, keyed by bout history bracket.
  // A fighter with no bouts cannot have ring_iq above 3 — only fighting breaks these caps.
  noBouts: number
  fewBouts_1_to_5: number
  experienced_6_to_20: number
  veteran_21_plus: number
  note?: string
}

export interface BackgroundModifiers {
  // Flat modifier applied to all starting technical attribute values.
  // Self-taught fighters lack structured fundamentals; gym-trained fighters start higher.
  selfTaught: number
  priorGym: number
  note?: string
}

export interface StartingValueFormula {
  // Base attribute value by years of training — interpolated between listed breakpoints.
  // Keys are year thresholds as strings (JSON object constraint); values are integers.
  // Note key is a documentation string, not a data value.
  baseByYearsTraining: Record<string, number | string>
  mentalAttributeStartingCap: MentalAttributeStartingCap
  backgroundModifiers: BackgroundModifiers
}

export interface AttributeAccumulationData {
  startingValueFormula: StartingValueFormula
}
