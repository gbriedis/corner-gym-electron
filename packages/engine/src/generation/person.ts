// generatePerson creates a complete person from the game data.
// Generation order matters — each layer feeds the next:
// 1. Identity (nation, city, name, age, background)
// 2. Soul traits (one from each pair, rolled from universal definitions)
// 3. Physical profile (rolled from physical-stats, anchored to weight class)
// 4. Health baseline (rolled from health definitions, nudged by gifts and flaws)
// 5. Gifts and flaws (independent probability rolls per eligible attribute)
// 6. Attributes (rolled within generationMax, modified by physical profile,
//    gifts and flaws — potential set here, current starts equal to potential
//    then reduced by age factor)
//
// Health is generated before gifts/flaws in this implementation even though
// the nudge is applied after — gifts/flaws are rolled first, then health bands
// are built with nudge adjustments before the final health roll.

import type { GameData } from '../data/loader.js'
import type { RNG } from '../utils/rng.js'
import type {
  Person,
  PhysicalProfile,
  SoulTraitAssignment,
  AttributeValue,
  HealthValue,
  GiftFlawAssignment,
} from '../types/person.js'
import type { SoulTrait } from '../types/data/soulTraits.js'
import type { GiftOrFlaw } from '../types/data/giftsAndFlaws.js'
import type { GenerationBand } from '../types/data/health.js'
import type { DevelopmentProfile } from '../types/data/developmentProfiles.js'

// ─── Identity helpers ────────────────────────────────────────────────────────

// generateId produces a deterministic hex id from the seeded RNG.
// Using the RNG (not Date.now) ensures the same seed always produces the same person.
function generateId(rng: RNG): string {
  const hex = (n: number): string => Math.floor(n * 0xffffffff).toString(16).padStart(8, '0')
  return `${hex(rng.next())}-${hex(rng.next())}-${hex(rng.next())}`
}

// calculateAgeFactor derives the current/potential ratio from the person's
// development profile and their specific peak age.
// Before peak: linear rise from a base of 0.55 at age 14, using profile riseRate.
// At/near peak: plateau at 0.98 for plateauDuration years.
// After plateau: linear decline using profile declineRate, floored at 0.40.
// Using data-driven rates rather than hardcoded values means development curves
// can be tuned in JSON without touching engine code.
export function calculateAgeFactor(age: number, peakAge: number, profile: DevelopmentProfile): number {
  const BASE = 0.55
  const BASE_AGE = 14
  const PEAK_FACTOR = 0.98
  const FLOOR = 0.40

  const plateauEnd = peakAge + profile.plateauDuration

  if (age <= peakAge) {
    // Linear rise from BASE at BASE_AGE toward PEAK_FACTOR at peakAge.
    // riseRate controls the slope — early bloomers rise faster.
    const years = age - BASE_AGE
    return Math.min(PEAK_FACTOR, BASE + years * profile.riseRate)
  }

  if (age <= plateauEnd) {
    // Plateau: person is at or very near their ceiling.
    return PEAK_FACTOR
  }

  // Decline: linear fall after plateau ends, floored at FLOOR.
  const yearsAfterPlateau = age - plateauEnd
  return Math.max(FLOOR, PEAK_FACTOR - yearsAfterPlateau * profile.declineRate)
}

// ─── Physical profile helpers ─────────────────────────────────────────────────

// mergeNationProbabilities merges universal band probabilities with nation overrides.
// Only the overridden band IDs change; remaining bands are rescaled to fill the gap,
// preserving their relative weight while keeping the total at 1.0.
function mergeNationProbabilities(
  bands: ReadonlyArray<{ id: string; probability: number }>,
  overrides: Partial<Record<string, number>> | undefined,
): number[] {
  if (overrides === undefined || Object.keys(overrides).length === 0) {
    return bands.map(b => b.probability)
  }

  const overriddenIds = new Set(Object.keys(overrides))
  const overriddenSum = Object.keys(overrides).reduce(
    (sum, id) => sum + (overrides[id] ?? 0),
    0,
  )
  const remaining = 1 - overriddenSum
  const originalNonOverriddenSum = bands
    .filter(b => !overriddenIds.has(b.id))
    .reduce((sum, b) => sum + b.probability, 0)
  const scaleFactor = originalNonOverriddenSum > 0 ? remaining / originalNonOverriddenSum : 0

  return bands.map(b => {
    if (overriddenIds.has(b.id)) return overrides[b.id] ?? b.probability
    return b.probability * scaleFactor
  })
}

// ─── Health helpers ───────────────────────────────────────────────────────────

// nudgedBandProbabilities shifts a health band probability toward 'iron' or 'fragile'.
// Doubles the target band's probability and renormalises the rest.
// This is probabilistic influence only — it never guarantees an iron or fragile result.
function nudgedBandProbabilities(
  bands: GenerationBand[],
  toward: 'toward_iron' | 'toward_fragile',
): number[] {
  const targetId = toward === 'toward_iron' ? 'iron' : 'fragile'
  const targetIndex = bands.findIndex(b => b.id === targetId)
  if (targetIndex === -1) return bands.map(b => b.probability)

  const boosted = bands.map((b, i) => ({
    probability: i === targetIndex ? b.probability * 2 : b.probability,
    id: b.id,
  }))
  const total = boosted.reduce((s, b) => s + b.probability, 0)
  return boosted.map(b => b.probability / total)
}

// ─── Gift / flaw helpers ──────────────────────────────────────────────────────

// groupTraitPairs extracts the 8 unique opposite-pairs from the traits list.
// Iterating in order and marking seen IDs guarantees we visit each pair exactly once.
function groupTraitPairs(traits: SoulTrait[]): [SoulTrait, SoulTrait][] {
  const seen = new Set<string>()
  const pairs: [SoulTrait, SoulTrait][] = []
  for (const trait of traits) {
    if (seen.has(trait.id)) continue
    const opposite = traits.find(t => t.id === trait.opposite)
    if (opposite === undefined) throw new Error(`No opposite found for soul trait "${trait.id}"`)
    pairs.push([trait, opposite])
    seen.add(trait.id)
    seen.add(trait.opposite)
  }
  return pairs
}

// rollGiftsAndFlaws runs independent probability rolls for each gift-eligible attribute.
// Gift is checked first — if it fires, the flaw roll for that attribute is skipped.
// This prevents a person from holding both a gift and a flaw for the same attribute,
// which would be a contradictory mechanical state.
function rollGiftsAndFlaws(entries: GiftOrFlaw[], rng: RNG): GiftFlawAssignment[] {
  const result: GiftFlawAssignment[] = []

  // Group entries by appliesTo so we can enforce the one-per-attribute rule.
  const byAttribute = new Map<string, { gift?: GiftOrFlaw; flaw?: GiftOrFlaw }>()
  for (const entry of entries) {
    const slot = byAttribute.get(entry.appliesTo) ?? {}
    if (entry.type === 'gift') slot.gift = entry
    else slot.flaw = entry
    byAttribute.set(entry.appliesTo, slot)
  }

  for (const [, { gift, flaw }] of byAttribute) {
    if (gift !== undefined && rng.next() < gift.giftProbability) {
      result.push({ entryId: gift.id, type: 'gift', appliesTo: gift.appliesTo, discovered: false })
      continue // flaw skipped — a gift and flaw on the same attribute contradict each other
    }
    if (flaw !== undefined && rng.next() < flaw.flawProbability) {
      result.push({ entryId: flaw.id, type: 'flaw', appliesTo: flaw.appliesTo, discovered: false })
    }
  }

  return result
}

// collectPhysicalModifiers builds a map of attribute id → total modifier from all
// physical profile bands that were rolled. Reach, hand size, neck, bone, and proportions
// all carry numeric attribute modifiers. Height does not.
function collectPhysicalModifiers(
  reachBandId: string,
  handSizeBandId: string,
  neckThicknessBandId: string,
  boneDensityBandId: string,
  bodyProportionsBandId: string,
  data: GameData,
): Map<string, number> {
  const modifiers = new Map<string, number>()

  const applyBand = (bandId: string, profile: { bands: Array<{ id: string; attributeModifiers: Record<string, number> }> }): void => {
    const band = profile.bands.find(b => b.id === bandId)
    if (band === undefined) return
    for (const [attrId, value] of Object.entries(band.attributeModifiers)) {
      modifiers.set(attrId, (modifiers.get(attrId) ?? 0) + value)
    }
  }

  applyBand(reachBandId, data.physicalStats.reachProfile)
  applyBand(handSizeBandId, data.physicalStats.handSizeProfile)
  applyBand(neckThicknessBandId, data.physicalStats.neckThicknessProfile)
  applyBand(boneDensityBandId, data.physicalStats.boneDensityProfile)
  applyBand(bodyProportionsBandId, data.physicalStats.bodyProportionsProfile)

  return modifiers
}

// ─── Main generation function ─────────────────────────────────────────────────

export function generatePerson(data: GameData, rng: RNG, nationId: string, cityId: string): Person {
  // Step 1 — Identity
  //
  // Nation and city are provided by the caller; we validate city belongs to the nation.
  // Weight class is picked randomly to anchor physical generation — a Person is not
  // yet a competitor, so no weight class is stored, but we need one to get a realistic
  // height from baseHeightByWeightClassCm.

  const nationBundle = data.nations[nationId]
  if (nationBundle === undefined) {
    throw new Error(`Nation "${nationId}" was not found in loaded game data.`)
  }

  const cities = nationBundle.cities.cities
  const city = cities.find(c => c.id === cityId)
  if (city === undefined) {
    throw new Error(`City "${cityId}" does not exist in nation "${nationId}"`)
  }

  const age = rng.nextInt(16, 32)

  const names = nationBundle.names
  const firstName = rng.pick(names.male.firstNames)
  const surname = rng.pick(names.male.surnames)

  const economicStatuses = nationBundle.economicStatuses.statuses
  const economicStatus = rng.weightedPick(
    economicStatuses,
    economicStatuses.map(s => s.weight),
  )

  const reasons = nationBundle.reasonsForBoxing.reasons
  const reasonForBoxing = rng.weightedPick(
    reasons,
    reasons.map(r => r.weight),
  )

  // Development profile is rolled in Step 1 because peakAge feeds the ageFactor
  // calculation in Step 6 — it must be known before attributes are rolled.
  const profiles = data.developmentProfiles.profiles
  const profile = rng.weightedPick(profiles, profiles.map(p => p.probability))
  const peakAge = rng.nextInt(profile.peakAgeRange.min, profile.peakAgeRange.max)

  // Step 2 — Soul traits
  //
  // Each pair produces exactly one trait. No person can hold both sides of a pair —
  // that would make their psychological core self-contradictory and break moment logic.
  const traitPairs = groupTraitPairs(data.soulTraits.traits)
  const soulTraits: SoulTraitAssignment[] = traitPairs.map(pair => ({
    traitId: rng.pick(pair).id,
    revealed: false,
  }))

  // Step 3 — Physical profile
  //
  // Weight class is chosen randomly to produce a realistic height for this person's
  // body type. super_heavyweight is excluded because it is amateur-only and generates
  // unrealistically large bodies for a general Person. The weight class is not stored —
  // it is scaffolding for height calculation only.
  const physicalWeightClasses = data.weightClasses.weightClasses.filter(wc => wc.amateurOnly !== true)
  const physicalWeightClass = rng.pick(physicalWeightClasses)

  const nationProfile = nationBundle.nation.physicalProfile

  const heightBands = data.physicalStats.heightProfile.bands
  const heightProbs = mergeNationProbabilities(heightBands, nationProfile.heightProfile)
  const heightBand = rng.weightedPick(heightBands, heightProbs)
  const baseHeight = data.physicalStats.heightProfile.baseHeightByWeightClassCm[physicalWeightClass.id]
  if (baseHeight === undefined) {
    throw new Error(`No base height found for weight class "${physicalWeightClass.id}"`)
  }
  const heightCm = Math.round(baseHeight + heightBand.heightOffsetCm)

  const reachBands = data.physicalStats.reachProfile.bands
  const reachProbs = mergeNationProbabilities(reachBands, nationProfile.reachProfile)
  const reachBand = rng.weightedPick(reachBands, reachProbs)
  const reachCm = Math.round(heightCm * reachBand.ratioToHeight)

  // Body weight hovers slightly above the weight class limit — fighters walk around
  // heavier than competition weight. Heavyweight has no limit so we use a fixed range.
  let weightKg: number
  if (physicalWeightClass.limitKg === null) {
    weightKg = 91 + Math.floor(rng.next() * 25) // 91–115 kg for heavyweight builds
  } else {
    weightKg = Math.round(physicalWeightClass.limitKg * (1 + rng.next() * 0.08))
  }

  const handBands = data.physicalStats.handSizeProfile.bands
  const handProbs = mergeNationProbabilities(handBands, nationProfile.handSizeProfile)
  const handBand = rng.weightedPick(handBands, handProbs)

  const neckBands = data.physicalStats.neckThicknessProfile.bands
  const neckProbs = mergeNationProbabilities(neckBands, nationProfile.neckThicknessProfile)
  const neckBand = rng.weightedPick(neckBands, neckProbs)

  const boneBands = data.physicalStats.boneDensityProfile.bands
  const boneProbs = mergeNationProbabilities(boneBands, nationProfile.boneDensityProfile)
  const boneBand = rng.weightedPick(boneBands, boneProbs)

  const propBands = data.physicalStats.bodyProportionsProfile.bands
  const propProbs = mergeNationProbabilities(propBands, nationProfile.bodyProportionsProfile)
  const propBand = rng.weightedPick(propBands, propProbs)

  const physicalProfile: PhysicalProfile = {
    heightCm,
    reachCm,
    weightKg,
    handSize: handBand.id,
    neckThickness: neckBand.id,
    boneDensity: boneBand.id,
    bodyProportions: propBand.id,
  }

  // Step 5 — Gifts and flaws
  //
  // Rolled before health so healthNudges can influence health band probabilities in step 4.
  // Independent roll per attribute — most people generate zero.
  const giftsAndFlaws = rollGiftsAndFlaws(data.giftsAndFlaws.giftsAndFlaws, rng)

  // Build a lookup of which attributes have gifts or flaws for use in steps 4 and 6.
  const giftByAttribute = new Map<string, GiftFlawAssignment>()
  const flawByAttribute = new Map<string, GiftFlawAssignment>()
  for (const assignment of giftsAndFlaws) {
    if (assignment.type === 'gift') giftByAttribute.set(assignment.appliesTo, assignment)
    else flawByAttribute.set(assignment.appliesTo, assignment)
  }

  // Build a lookup of healthNudge entries: bodyPartId → nudge direction.
  // Used in step 4 to shift health band probabilities for relevant body parts.
  const healthNudgeByBodyPart = new Map<string, 'toward_iron' | 'toward_fragile'>()
  for (const entry of data.giftsAndFlaws.giftsAndFlaws) {
    if (entry.healthNudge === null) continue
    const assignment = giftsAndFlaws.find(a => a.entryId === entry.id)
    if (assignment === undefined) continue
    const direction = assignment.type === 'gift' ? entry.healthNudge.giftShift : entry.healthNudge.flawShift
    if (direction !== 'toward_iron' && direction !== 'toward_fragile') continue
    for (const bodyPartId of entry.healthNudge.bodyParts) {
      healthNudgeByBodyPart.set(bodyPartId, direction)
    }
  }

  // Step 4 — Health baseline
  //
  // Each body part rolls independently from its generation bands.
  // If a gift or flaw assigned in step 5 carries a healthNudge for this body part,
  // the band probabilities are shifted toward iron (gift) or fragile (flaw) before rolling.
  const health: HealthValue[] = data.health.bodyParts.map(part => {
    const nudge = healthNudgeByBodyPart.get(part.id)
    const probs = nudge !== undefined
      ? nudgedBandProbabilities(part.generationBands, nudge)
      : part.generationBands.map(b => b.probability)

    const band = rng.weightedPick(part.generationBands, probs)
    const integrity = rng.nextInt(band.min, band.max)
    return { bodyPartId: part.id, integrity, damage: 0 }
  })

  // Step 6 — Attributes
  //
  // Collect physical modifiers before rolling — they apply to all attributes regardless
  // of gift/flaw status. Physical modifiers from height are not numeric in the data;
  // only reach, hand size, neck, bone density, and body proportions carry numbers.
  const physicalModifiers = collectPhysicalModifiers(
    reachBand.id,
    handBand.id,
    neckBand.id,
    boneBand.id,
    propBand.id,
    data,
  )

  const factor = calculateAgeFactor(age, peakAge, profile)

  const attributes: AttributeValue[] = data.attributes.attributes.map(attr => {
    const isGiftEligible = attr.scale.generationMax !== undefined
    const hasGift = giftByAttribute.has(attr.id)
    const hasFlaw = flawByAttribute.has(attr.id)

    // Determine generation ceiling before physical modifiers.
    // Gift-eligible without a gift: generationMax (18). With a gift: absoluteMax (20).
    // Non-gift-eligible: max (20 always).
    const genCap = isGiftEligible
      ? hasGift
        ? (attr.scale.absoluteMax ?? 20)
        : (attr.scale.generationMax ?? 18)
      : (attr.scale.max ?? 20)

    // Roll base value. If a flaw is present, roll twice and take the minimum —
    // this naturally skews the distribution toward lower values without a hard floor shift.
    const rollOnce = (): number => rng.nextInt(attr.scale.min, genCap)
    let base = hasGift ? rollOnce() : hasFlaw ? Math.min(rollOnce(), rollOnce()) : rollOnce()

    // Apply physical profile modifiers. These can push the value above or below range —
    // we clamp after rather than before so the modifier's full intent is preserved.
    const physMod = physicalModifiers.get(attr.id) ?? 0
    base = base + physMod

    // Potential is the final generation ceiling value after clamping.
    // Gift-eligible without gift must not exceed 18 even after physical modifiers.
    // This enforces the gift ceiling rule: a non-gifted attribute cannot accidentally
    // reach 19-20 just because physical profile modifiers pushed it there.
    const finalCap = isGiftEligible && !hasGift ? (attr.scale.generationMax ?? 18) : 20
    const potential = Math.max(attr.scale.min, Math.min(finalCap, base))

    // Current starts equal to potential then is reduced by the age factor.
    // A 16-year-old has not yet developed to their ceiling; a 28-year-old has.
    const current = Math.max(attr.scale.min, Math.round(potential * factor))

    return { attributeId: attr.id, current, potential }
  })

  return {
    id: generateId(rng),
    name: { first: firstName, surname },
    age,
    nationId,
    cityId,
    economicStatusId: economicStatus.id,
    reasonForBoxingId: reasonForBoxing.id,
    developmentProfileId: profile.id,
    peakAge,
    soulTraits,
    physicalProfile,
    health,
    attributes,
    giftsAndFlaws,
  }
}
