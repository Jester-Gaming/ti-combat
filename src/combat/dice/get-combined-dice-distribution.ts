import type { DieValue } from '@/types'

import {
  type DiceRollOutcome,
  getDiceDistribution,
} from './get-dice-distribution'

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
  return distributions.reduce(convolve)
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
      if (neededFromB >= 0 && neededFromB < b.length) {
        probability += outcomeA.probability * b[neededFromB].probability
      }
    }

    result.push({ hits, probability })
  }

  return result
}
