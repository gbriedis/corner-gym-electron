// All engine randomness flows through the seeded RNG.
// Using Math.random() directly is forbidden — results would not be
// reproducible across sessions, making saves impossible to debug.
//
// Mulberry32 algorithm chosen: 32-bit state, simple implementation,
// adequate statistical quality for game simulation. Not cryptographically
// secure, but that is not a requirement here. Chosen over xoshiro128**
// because the single-state simplicity makes it easier to reason about
// determinism across session boundaries.

export interface RNG {
  next(): number
  nextInt(min: number, max: number): number
  pick<T>(array: T[]): T
  weightedPick<T>(items: T[], weights: number[]): T
}

export function createRng(seed: number): RNG {
  // Unsigned 32-bit state — ensures consistent behaviour across platforms.
  let s = seed >>> 0

  function next(): number {
    s += 0x6D2B79F5
    let z = s
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }

  function nextInt(min: number, max: number): number {
    // Inclusive on both ends.
    return Math.floor(next() * (max - min + 1)) + min
  }

  function pick<T>(array: T[]): T {
    if (array.length === 0) throw new Error('Cannot pick from empty array')
    return array[nextInt(0, array.length - 1)]
  }

  function weightedPick<T>(items: T[], weights: number[]): T {
    if (items.length === 0) throw new Error('Cannot weightedPick from empty array')
    if (items.length !== weights.length) {
      throw new Error('Items and weights arrays must have equal length')
    }
    const total = weights.reduce((a, b) => a + b, 0)
    let r = next() * total
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]
      if (r <= 0) return items[i]
    }
    // Guard against floating-point rounding — return last item.
    return items[items.length - 1]
  }

  return { next, nextInt, pick, weightedPick }
}
