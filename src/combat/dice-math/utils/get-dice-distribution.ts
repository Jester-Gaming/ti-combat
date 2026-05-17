import type { DiceGroup } from '@/types'

interface DiceRollOutcome {
  hits: number
  probability: number
}

/** Probability of a single d10 producing a hit at the given hit value.
 *  Clamped to [0, 1] so modifier-pushed values outside the rollable range
 *  collapse to the correct bounds (>10 → always miss, <1 → always hit). */
export function hitProb(hitValue: number): number {
  return Math.max(0, Math.min(1, (11 - hitValue) / 10))
}

/** Binomial PMF over `n` Bernoulli(p) trials, returned as `result[k] = P(k hits)`
 *  for `k ∈ [0, n]`. Short-circuits the degenerate cases (`n=0`, `p=0`, `p=1`). */
export function binomial(n: number, p: number): number[] {
  const out = new Array<number>(n + 1).fill(0)
  if (n === 0) {
    out[0] = 1
    return out
  }
  if (p <= 0) {
    out[0] = 1
    return out
  }
  if (p >= 1) {
    out[n] = 1
    return out
  }
  let coeff = 1
  for (let k = 0; k <= n; k++) {
    out[k] = coeff * Math.pow(p, k) * Math.pow(1 - p, n - k)
    coeff = (coeff * (n - k)) / (k + 1)
  }
  return out
}

const diceDistCache = new Map<string, DiceRollOutcome[]>()

export function getDiceDistribution(group: DiceGroup): DiceRollOutcome[] {
  const [hitValue, baseDice, bonusDice = 0] = group
  const diceCount = baseDice + bonusDice
  const cacheKey = `${hitValue}:${diceCount}`
  const cached = diceDistCache.get(cacheKey)
  if (cached) return cached

  const pmf = binomial(diceCount, hitProb(hitValue))
  const distribution: DiceRollOutcome[] = pmf.map((probability, hits) => ({
    hits,
    probability,
  }))

  diceDistCache.set(cacheKey, distribution)
  return distribution
}
