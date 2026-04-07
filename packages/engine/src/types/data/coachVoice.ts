// Matches all three coach voice files under nations/{nation}/coach-voice/.

import type { Meta } from './meta.js'

// Shared across coach-voice/attributes.json — one band per value range.
export interface CoachVoiceBand {
  range: string
  label: string
  lines: string[]
}

// One entry per attribute in coach-voice/attributes.json.
export interface CoachVoiceAttribute {
  attributeId: string
  bands: CoachVoiceBand[]
}

// One entry per notable physical profile in coach-voice/physical-stats.json.
// Uses coachLine (not lines) to match the JSON field name.
export interface CoachVoiceProfile {
  profileId: string
  coachLine: string[]
}

// One entry per gift or flaw in coach-voice/gifts-and-flaws.json.
export interface CoachVoiceGiftFlaw {
  id: string
  type: 'gift' | 'flaw'
  lines: string[]
}

// Matches coach-voice/attributes.json
export interface CoachVoiceAttributesData {
  meta: Meta
  attributes: CoachVoiceAttribute[]
}

// Matches coach-voice/physical-stats.json
// Array key is physicalObservations — only notable profiles produce a coach line.
export interface CoachVoicePhysicalData {
  meta: Meta
  physicalObservations: CoachVoiceProfile[]
}

// Matches coach-voice/gifts-and-flaws.json
export interface CoachVoiceGiftsFlawsData {
  meta: Meta
  giftsAndFlaws: CoachVoiceGiftFlaw[]
}
