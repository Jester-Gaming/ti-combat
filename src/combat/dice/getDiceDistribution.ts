import type { DieValue } from '@/types'

export interface DiceRollOutcome {
  hits: number
  probability: number
}

function binomialCoeff(n: number, k: number): number {
  if (k > n || k < 0) return 0
  if (k === 0 || k === n) return 1
  if (k > n - k) k = n - k

  let result = 1
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

export function getDiceDistribution(dieValue: DieValue): DiceRollOutcome[] {
  const [hitValue, diceCount] = dieValue

  if (diceCount === 0) {
    return [{ hits: 0, probability: 1 }]
  }

  // d10: hit on hitValue or higher (1-10 scale)
  const hitProb = (11 - hitValue) / 10
  const missProb = 1 - hitProb

  const distribution: DiceRollOutcome[] = []

  for (let hits = 0; hits <= diceCount; hits++) {
    const probability =
      binomialCoeff(diceCount, hits) *
      Math.pow(hitProb, hits) *
      Math.pow(missProb, diceCount - hits)
    distribution.push({ hits, probability })
  }

  return distribution
}
