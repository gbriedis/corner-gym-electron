// calculateAttributeEvents derives attribute history events from a completed bout.
// Reads gain rules from attribute-accumulation.json.
// Soul trait multipliers applied here — humble fighter gains more from a loss,
// fragile fighter's composure regresses after a stoppage loss.
//
// Returns AttributeHistoryEvent[] for each fighter — to be applied to their
// attributeHistory records after the bout is saved.

import type { Fighter, AttributeHistoryEvent } from '../types/fighter.js'
import type { ResolutionMethod } from '../types/resolution.js'
import type { GameData } from '../data/loader.js'
import type { EventGainEntry } from '../types/data/attributeAccumulation.js'

// mapCircuitLevelToEventType classifies a circuit level into one of the four
// attribute accumulation event types. Amateur bouts produce less mental growth
// than pro bouts because the stakes are lower and the opposition quality is narrower.
// Olympic bouts are the apex of amateur mental development; title fights for pro.
function mapCircuitLevelToEventType(
  circuitLevel: string,
): 'amateur_bout' | 'pro_bout' | 'title_fight' | 'olympic_bout' {
  if (circuitLevel === 'olympics' || circuitLevel.includes('olympic')) return 'olympic_bout'
  if (circuitLevel.includes('title')) return 'title_fight'
  if (circuitLevel.startsWith('pro') || circuitLevel.includes('pro_')) return 'pro_bout'
  return 'amateur_bout'
}

// resolveBaseGains builds the final per-attribute gain map for an event type,
// handling inheritance (title_fight inherits from pro_bout with a multiplier).
function resolveBaseGains(
  eventType: string,
  eventBaseGains: Record<string, EventGainEntry>,
): Record<string, number> {
  const entry = eventBaseGains[eventType]
  if (entry === undefined) return {}

  if (entry.inheritsFrom !== undefined) {
    // Start from parent gains and apply overall multiplier
    const parent = resolveBaseGains(entry.inheritsFrom, eventBaseGains)
    const multiplier = entry.overallMultiplier ?? 1.0
    const result: Record<string, number> = {}
    for (const [attr, val] of Object.entries(parent)) {
      result[attr] = val * multiplier
    }
    // additionalGains override specific attributes — the occasion demands more
    // from those particular attributes than the multiplied parent provides.
    if (entry.additionalGains !== undefined) {
      for (const [attr, val] of Object.entries(entry.additionalGains)) {
        result[attr] = val
      }
    }
    return result
  }

  return entry.gains ?? {}
}

// computeOppositionMultiplier determines the gain multiplier based on how strong
// the opposition was relative to the fighter. Fighting up forces adaptation;
// fighting down offers little learning. The ratio is fighterLevel / opponentLevel:
// below 1.0 means the opponent was stronger (better opposition for development).
function computeOppositionMultiplier(
  fighterOverall: number,
  oppositionQuality: number,
  data: GameData,
): number {
  if (oppositionQuality <= 0) return 1.0
  const ratio = fighterOverall / oppositionQuality

  const thresholds = data.attributeAccumulation.oppositionQualityMultipliers
  if (ratio < (thresholds.significantly_better.thresholdRatio ?? 0.8)) {
    return thresholds.significantly_better.multiplier
  }
  if (ratio < (thresholds.better.thresholdRatio ?? 0.9)) {
    return thresholds.better.multiplier
  }
  if (ratio < (thresholds.matched.thresholdRatio ?? 1.1)) {
    return thresholds.matched.multiplier
  }
  if (ratio < (thresholds.weaker.thresholdRatio ?? 1.3)) {
    return thresholds.weaker.multiplier
  }
  return thresholds.significantly_weaker.multiplier
}

// computeFighterOverall derives a 0-100 overall level for the fighter.
// Used only for opposition quality ratio calculation — not shown to the player.
function computeFighterOverall(fighter: Fighter): number {
  if (fighter.developedAttributes.length === 0) return 50
  const sum = fighter.developedAttributes.reduce((acc, a) => acc + a.current, 0)
  // Normalise from 1-20 attribute scale to 0-100
  return (sum / fighter.developedAttributes.length) / 20 * 100
}

function hasTrait(fighter: Fighter, traitId: string): boolean {
  return fighter.soulTraits.some(t => t.traitId === traitId)
}

// applySoulTraitMultipliers adjusts the raw gains map according to the fighter's
// permanent soul traits. A humble fighter absorbs more from losses; a fragile
// fighter's composure regresses after being stopped. These traits cannot be changed —
// they are who the fighter is, and development reflects that.
function applySoulTraitMultipliers(
  rawGains: Record<string, number>,
  fighter: Fighter,
  result: 'win' | 'loss' | 'draw',
  method: ResolutionMethod,
  data: GameData,
): Record<string, number> {
  const gains = { ...rawGains }
  const soulMultipliers = data.attributeAccumulation.soulTraitMultipliers
  const isLoss = result === 'loss'
  const isStoppageLoss = isLoss && (method === 'ko' || method === 'tko')

  for (const [traitId, config] of Object.entries(soulMultipliers)) {
    if (!hasTrait(fighter, traitId)) continue

    const appliesTo = config.appliesTo
    const applicableAttrs = appliesTo === 'all' || appliesTo === 'all_technical'
      ? Object.keys(gains)
      : Array.isArray(appliesTo) ? appliesTo : [appliesTo]

    for (const attr of applicableAttrs) {
      if (!(attr in gains)) continue

      // Loss-specific gain multiplier — some traits make fighters learn more or less from losses
      if (isLoss && config.lossGainMultiplier !== undefined) {
        gains[attr] = (gains[attr] ?? 0) * config.lossGainMultiplier
        continue  // lossGainMultiplier replaces the standard gainMultiplier for losses
      }

      if (config.gainMultiplier !== undefined) {
        gains[attr] = (gains[attr] ?? 0) * config.gainMultiplier
      }

      // Stoppage loss regression — fragile fighters can lose composure and heart
      // after being stopped. The occasion breaks something they cannot easily rebuild.
      if (isStoppageLoss && config.stoppageRegressionMultiplier !== undefined) {
        // For regression-eligible attributes (composure, heart), multiply the gain by
        // the regression multiplier — negative gains become more negative.
        gains[attr] = (gains[attr] ?? 0) * config.stoppageRegressionMultiplier
      }
    }
  }

  return gains
}

export function calculateAttributeEvents(
  fighter: Fighter,
  result: 'win' | 'loss' | 'draw',
  method: ResolutionMethod,
  oppositionQuality: number,
  circuitLevel: string,
  year: number,
  week: number,
  data: GameData,
): AttributeHistoryEvent[] {
  const eventType = mapCircuitLevelToEventType(circuitLevel)
  const accum = data.attributeAccumulation

  // 1. Resolve base gains for this event type (handles inheritance)
  const baseGains = resolveBaseGains(eventType, accum.eventBaseGains)

  // 2. Apply result modifier — wins, losses, and stoppage losses differ
  const resultKey = result === 'loss' && (method === 'ko' || method === 'tko')
    ? 'stoppage_loss'
    : result
  const resultMod = accum.resultModifiers[resultKey as keyof typeof accum.resultModifiers]
  const resultMultiplier = resultMod?.multiplier ?? 1.0
  const attrOverrides = resultMod?.attributeOverrides ?? {}

  const afterResultGains: Record<string, number> = {}
  for (const [attr, baseGain] of Object.entries(baseGains)) {
    const override = attrOverrides[attr]
    const multiplier = override !== undefined ? override : resultMultiplier
    afterResultGains[attr] = baseGain * multiplier
  }

  // 3. Apply opposition quality multiplier
  const fighterOverall = computeFighterOverall(fighter)
  const oppMultiplier = computeOppositionMultiplier(fighterOverall, oppositionQuality, data)
  const afterOppGains: Record<string, number> = {}
  for (const [attr, gain] of Object.entries(afterResultGains)) {
    afterOppGains[attr] = gain * oppMultiplier
  }

  // 4. Apply soul trait multipliers
  const afterSoulGains = applySoulTraitMultipliers(afterOppGains, fighter, result, method, data)

  // 5. Cap each gain at the per-event max — prevents unrealistic single-event jumps
  const trigger = eventType as AttributeHistoryEvent['trigger']
  const cap = accum.singleEventGainCap[eventType as keyof typeof accum.singleEventGainCap]
  const gainCap = typeof cap === 'number' ? cap : Infinity

  // 6. Build the event list — one event per attribute, only emit non-zero deltas
  const events: AttributeHistoryEvent[] = []
  for (const [attr, gain] of Object.entries(afterSoulGains)) {
    if (gain === 0) continue
    const capped = Math.sign(gain) * Math.min(Math.abs(gain), gainCap)
    events.push({
      attributeId: attr,
      year,
      week,
      trigger,
      delta: capped,
      oppositionQuality,
    })
  }

  return events
}
