import type { DiceGroup } from '@/types'

import { getDiceDistribution } from './get-dice-distribution'

/** Per-group outcome of rolling a set of dice groups independently. */
export interface DiceOutcome {
  /** Hits per group, same order/length as input diceGroups. */
  hits: number[]
  probability: number
}

/**
 * Enumerate all possible per-group outcomes for a set of independent dice
 * groups (Cartesian product of per-group distributions). Preserves per-group
 * hit counts so abilities can distinguish which group produced hits.
 */
export function getDiceOutcomes(diceGroups: DiceGroup[]): DiceOutcome[] {
  if (diceGroups.length === 0) return [{ hits: [], probability: 1 }]

  let outcomes: DiceOutcome[] = [{ hits: [], probability: 1 }]

  for (const group of diceGroups) {
    const dist = getDiceDistribution(group)
    const next: DiceOutcome[] = []
    for (const prev of outcomes) {
      for (const d of dist) {
        const p = prev.probability * d.probability
        if (p === 0) continue
        next.push({ hits: [...prev.hits, d.hits], probability: p })
      }
    }
    outcomes = next
  }

  return outcomes
}
