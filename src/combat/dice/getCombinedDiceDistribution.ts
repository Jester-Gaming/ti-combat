import type { DieValue } from '@/types'
import {
  getDiceDistribution,
  type DiceRollOutcome,
} from './getDiceDistribution'

/**
 * Combines multiple dice groups into a single hit distribution.
 * Uses convolution to merge independent probability distributions.
 */
export function getCombinedDiceDistribution(
  diceGroups: DieValue[],
): DiceRollOutcome[] {
  if (diceGroups.length === 0) {
    return [{ hits: 0, probability: 1 }]
  }

  // Get distribution for each group
  const distributions = diceGroups.map(getDiceDistribution)

  // Combine via convolution
  let combined: DiceRollOutcome[] = distributions[0]

  for (let i = 1; i < distributions.length; i++) {
    combined = convolve(combined, distributions[i])
  }

  return combined
}

/**
 * Convolves two probability distributions.
 * Result[k] = sum of all A[i] * B[j] where i + j = k
 */
function convolve(
  a: DiceRollOutcome[],
  b: DiceRollOutcome[],
): DiceRollOutcome[] {
  const maxHits = a.length - 1 + (b.length - 1)
  const result: DiceRollOutcome[] = []

  for (let hits = 0; hits <= maxHits; hits++) {
    let probability = 0

    for (const outcomeA of a) {
      const neededFromB = hits - outcomeA.hits
      const outcomeB = b.find(o => o.hits === neededFromB)
      if (outcomeB) {
        probability += outcomeA.probability * outcomeB.probability
      }
    }

    result.push({ hits, probability })
  }

  return result
}
