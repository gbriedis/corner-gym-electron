// generateCoach creates a Coach from a Person.
// Two paths:
// 1. Former fighter — quality derived from career peak and soul traits
// 2. Specialist — quality assigned directly from experience tier
//
// Coaching style starts influenced by fighting background but is shaped
// by soul traits — a humble former brawler may become a technical coach
// because they coach what they wish they had, not what they were.
//
// Quality grows toward qualityPotential at 0.5 per year of coaching.
// styleCertainty grows 4 points per year up to the maximum for their role.

import type { Person } from '../types/person.js'
import type { Coach, CoachStyle } from '../types/coach.js'
import type { GameData } from '../data/loader.js'
import type { RNG } from '../utils/rng.js'

export interface CoachGenerationOptions {
  formerFighter: boolean
  careerPeakCircuitLevel?: string    // required if formerFighter = true
  careerPeakPrestige?: number        // required if formerFighter = true
  fightingStyleTendency?: string     // the style they used as a fighter
  specialistExperience?: 'new' | 'experienced' | 'veteran'  // required if formerFighter = false
  isGymMemberFilling?: boolean       // affects styleCertainty maximum
  yearsCoaching?: number             // how long they have been coaching at world generation
  role?: 'head_coach' | 'secondary_coach' | 'fitness_coach' | 'kids_coach'
}

// generateId produces a deterministic hex id from the seeded RNG.
// Using the RNG (not Date.now) ensures the same seed always produces the same coach.
function generateId(rng: RNG): string {
  const hex = (n: number): string => Math.floor(n * 0xffffffff).toString(16).padStart(8, '0')
  return `coach-${hex(rng.next())}-${hex(rng.next())}`
}

// clamp constrains a value within [min, max] inclusive.
function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value))
}

export function generateCoach(
  person: Person,
  gymId: string,
  data: GameData,
  rng: RNG,
  options: CoachGenerationOptions,
): Coach {
  const nationBundle = data.nations[person.nationId]
  if (nationBundle === undefined) {
    throw new Error(`Nation "${person.nationId}" not found in game data when generating coach`)
  }
  const coachGeneration = nationBundle.coachGeneration

  const traits = new Set(person.soulTraits.map(t => t.traitId))

  // ─── Quality ─────────────────────────────────────────────────────────────────

  let quality: number
  let qualityPotential: number

  if (options.formerFighter) {
    // Former fighters start with quality reflecting their career knowledge.
    // Soul traits determine how well they translate that knowledge into teaching.
    // A national champion who is arrogant and reckless is a worse coach than a
    // regional finalist who is humble and patient — experience without self-awareness
    // produces coaches who teach their ego, not their craft.
    const prestige = options.careerPeakPrestige ?? 0
    const baseQuality = (prestige / 7) * 10

    let traitModifier = 0
    if (traits.has('humble'))      traitModifier += 2
    if (traits.has('patient'))     traitModifier += 2
    if (traits.has('trusting'))    traitModifier += 1
    if (traits.has('disciplined')) traitModifier += 1
    if (traits.has('arrogant'))    traitModifier -= 2
    if (traits.has('reckless'))    traitModifier -= 2
    if (traits.has('paranoid'))    traitModifier -= 1

    quality = clamp(1, 18, Math.round(baseQuality + traitModifier))
    qualityPotential = clamp(quality, 20, quality + rng.nextInt(1, 3))
  } else {
    // Specialists have no career knowledge to draw on — quality comes entirely from
    // how long they have studied and worked in the sport. Experience tier reflects
    // how much ground they have covered through study and gym work alone.
    const experience = options.specialistExperience ?? 'new'
    const tier = coachGeneration.specialistQualityByExperience[experience]
    quality = rng.nextInt(tier.qualityRange[0], tier.qualityRange[1])
    const potentialBonus = rng.nextInt(tier.potentialBonus[0], tier.potentialBonus[1])
    qualityPotential = Math.min(20, quality + potentialBonus)
  }

  // If this coach has been coaching for years before world start, advance quality
  // toward potential. Quality grows at 0.5 per year — experience compounds slowly
  // because coaching insight deepens with repeated cycles, not with raw time alone.
  const yearsCoaching = options.yearsCoaching ?? 0
  if (yearsCoaching > 0) {
    const growth = yearsCoaching * coachGeneration.qualityGrowthPerYear
    quality = clamp(1, qualityPotential, Math.round(quality + growth))
  }

  // ─── Coaching Style — Emphasis ───────────────────────────────────────────────

  let emphasis: CoachStyle['emphasis']

  if (options.formerFighter && options.fightingStyleTendency !== undefined) {
    const tendency = options.fightingStyleTendency

    // Map fighting tendency to coaching emphasis as a starting tendency.
    // This is where the coach begins, shaped by what they personally did in the ring.
    if (tendency === 'pressure' || tendency === 'swarmer') {
      emphasis = 'pressure'
    } else if (tendency === 'boxer' || tendency === 'counterpuncher') {
      emphasis = 'technical'
    } else if (tendency === 'boxer_puncher') {
      emphasis = 'balanced'
    } else if (tendency === 'brawler') {
      emphasis = 'physical'
    } else {
      // 'undefined' style — coach has no strong tendency to carry forward.
      emphasis = 'balanced'
    }

    // Humble + patient coaches study what fighters need, not what they personally did.
    // A former brawler with these traits becomes technical — they recognise what they
    // lacked and build a teaching identity around skills they had to fight without.
    if (traits.has('humble') && traits.has('patient')) {
      emphasis = 'technical'
    } else if (traits.has('reckless')) {
      // Reckless coaches gravitate toward physical output — they have never valued
      // the technical discipline required to teach it convincingly.
      emphasis = 'physical'
    }
  } else {
    // Specialists have no fighting background to start from.
    // Technical and balanced emphases are more common because specialists tend to
    // enter coaching through study rather than raw competitive instinct.
    const emphasisOptions: CoachStyle['emphasis'][] = [
      'technical', 'balanced', 'pressure', 'physical', 'defensive',
    ]
    const emphasisWeights = [35, 30, 15, 15, 5]
    emphasis = rng.weightedPick(emphasisOptions, emphasisWeights)
  }

  // ─── Coaching Style — Methodology ────────────────────────────────────────────

  // Disciplined coaches build structured systems around everything they do.
  // Reckless coaches resist structure — they prefer instinct over process.
  // Neither trait produces the default structured-but-flexible middle ground.
  let methodology: CoachStyle['methodology']
  if (traits.has('disciplined')) {
    methodology = 'disciplined'
  } else if (traits.has('reckless')) {
    methodology = 'freestyle'
  } else {
    methodology = 'structured'
  }

  // ─── Coaching Style — Communication ──────────────────────────────────────────

  // Communication style is about how the coach delivers feedback, not what they say.
  // Brave/determined coaches without fragility push fighters hard — they believe
  // in demanding standards because that is how they held themselves together.
  // Humble/patient coaches without arrogance support rather than push — they build
  // confidence gradually, reading the fighter's needs before applying pressure.
  // Paranoid or content coaches disengage — paranoid sees politics everywhere,
  // content does not need the fighter to succeed as much as the fighter does.
  let communicationStyle: CoachStyle['communicationStyle']
  if ((traits.has('brave') || traits.has('determined')) && !traits.has('fragile')) {
    communicationStyle = 'demanding'
  } else if ((traits.has('humble') || traits.has('patient')) && !traits.has('arrogant')) {
    communicationStyle = 'supportive'
  } else if (traits.has('paranoid') || traits.has('content')) {
    communicationStyle = 'detached'
  } else {
    communicationStyle = 'supportive'
  }

  // ─── Style Certainty ─────────────────────────────────────────────────────────

  // Base certainty is low — most coaches are still finding who they are as teachers.
  // Years of coaching grows certainty up to the applicable maximum:
  // gym members filling the role informally hit a lower ceiling than hired specialists,
  // because a hired coach has made coaching their identity in a way an informal fill-in has not.
  const base = rng.nextInt(15, 35)
  const yearsBoost = yearsCoaching * coachGeneration.styleCertaintyGrowthPerYear
  const maximum = options.isGymMemberFilling === true
    ? coachGeneration.maximumStyleCertaintyGymMember
    : coachGeneration.maximumStyleCertaintyHiredCoach
  const styleCertainty = clamp(0, maximum, Math.round(base + yearsBoost))

  return {
    id: generateId(rng),
    personId: person.id,
    gymId,
    role: options.role ?? 'secondary_coach',
    quality,
    qualityPotential,
    weeksCoaching: Math.round(yearsCoaching * 52),
    style: { emphasis, methodology, communicationStyle },
    styleCertainty,
    formerFighter: options.formerFighter,
    careerPeakCircuitLevel: options.careerPeakCircuitLevel ?? null,
    careerPeakPrestige: options.careerPeakPrestige ?? 0,
    fighterRelationships: [],
  }
}
