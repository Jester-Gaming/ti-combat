import { describe, expect, it } from 'vitest'

import {
  buildRerollStrategy,
  type HitsDist,
  strategyToPredicate,
} from '@/combat/dice-math/reroll-strategy'

// Single die at 40% hit: P(0)=0.6, P(1)=0.4. Mean = 0.4.
const singleDie: HitsDist = [
  { hits: 0, probability: 0.6 },
  { hits: 1, probability: 0.4 },
]

// Two cruisers at 40%: P(0)=0.36, P(1)=0.48, P(2)=0.16. Mean = 0.8.
const twoCruiser: HitsDist = [
  { hits: 0, probability: 0.36 },
  { hits: 1, probability: 0.48 },
  { hits: 2, probability: 0.16 },
]

// No dice: the only outcome is 0 hits.
const noDice: HitsDist = [{ hits: 0, probability: 1 }]

describe('strategyToPredicate IF_HITS_PERCENT_LE ("worse than N%")', () => {
  const pred = strategyToPredicate(
    buildRerollStrategy('IF_HITS_PERCENT_LE', 50),
  )

  it('rerolls a single-die miss (below the mean) under "worse than 50%"', () => {
    expect(pred({ total: 0, distribution: singleDie })).toBe(true)
  })

  it('keeps a single-die hit (above the mean)', () => {
    expect(pred({ total: 1, distribution: singleDie })).toBe(false)
  })

  it('keeps 2-cruiser behavior: reroll 0 hits, keep 1 and 2', () => {
    expect(pred({ total: 0, distribution: twoCruiser })).toBe(true)
    expect(pred({ total: 1, distribution: twoCruiser })).toBe(false)
    expect(pred({ total: 2, distribution: twoCruiser })).toBe(false)
  })

  it('does not fire on a degenerate (no-dice) distribution', () => {
    expect(pred({ total: 0, distribution: noDice })).toBe(false)
  })
})

describe('strategyToPredicate IF_HITS_PERCENT_GE ("better than N%")', () => {
  const pred = strategyToPredicate(
    buildRerollStrategy('IF_HITS_PERCENT_GE', 50),
  )

  it('rerolls a single-die hit (above the mean) under "better than 50%"', () => {
    expect(pred({ total: 1, distribution: singleDie })).toBe(true)
  })

  it('keeps a single-die miss (below the mean)', () => {
    expect(pred({ total: 0, distribution: singleDie })).toBe(false)
  })

  it('does not fire on a degenerate (no-dice) distribution', () => {
    expect(pred({ total: 0, distribution: noDice })).toBe(false)
  })
})
