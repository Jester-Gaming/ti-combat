import type { DiceGroup } from '@/types'

export interface DiceRollOutcome {
  hits: number
  probability: number
}

function binomialCoeff(n: number, k: number): number {
  if (k > n || k < 0) return 0
  if (k === 0 || k === n) return 1

  const effectiveK = Math.min(k, n - k)
  let result = 1
  for (let i = 0; i < effectiveK; i++) {
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

const diceDistCache = new Map<string, DiceRollOutcome[]>()

export function getDiceDistribution(group: DiceGroup): DiceRollOutcome[] {
  const [hitValue, baseDice, bonusDice = 0] = group
  const diceCount = baseDice + bonusDice
  const cacheKey = `${hitValue}:${diceCount}`
  const cached = diceDistCache.get(cacheKey)
  if (cached) return cached

  if (diceCount === 0) {
    const result = [{ hits: 0, probability: 1 }]
    diceDistCache.set(cacheKey, result)
    return result
  }

  // d10: hit on hitValue or higher (1-10 scale). Clamp to [0, 1] so
  // modifier-pushed hit values outside the rollable range collapse to the
  // correct bounds (>10 → always miss, <1 → always hit).
  const hitProb = Math.max(0, Math.min(1, (11 - hitValue) / 10))
  const missProb = 1 - hitProb

  const distribution: DiceRollOutcome[] = []

  for (let hits = 0; hits <= diceCount; hits++) {
    const probability =
      binomialCoeff(diceCount, hits) *
      Math.pow(hitProb, hits) *
      Math.pow(missProb, diceCount - hits)
    distribution.push({ hits, probability })
  }

  diceDistCache.set(cacheKey, distribution)
  return distribution
}
