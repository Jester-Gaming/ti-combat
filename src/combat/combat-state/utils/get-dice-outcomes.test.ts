import { describe, expect, it } from 'vitest'

import { getDiceOutcomes } from './get-dice-outcomes'

describe('getDiceOutcomes', () => {
  it('returns single empty outcome for empty input', () => {
    const outcomes = getDiceOutcomes([])
    expect(outcomes).toHaveLength(1)
    expect(outcomes[0]).toEqual({ hits: [], probability: 1 })
  })

  it('returns per-group distribution for one group', () => {
    const outcomes = getDiceOutcomes([[9, 1]])
    // 1 die at 9+: 20% hit, 80% miss
    expect(outcomes).toHaveLength(2)
    const miss = outcomes.find(o => o.hits[0] === 0)
    const hit = outcomes.find(o => o.hits[0] === 1)
    expect(miss?.probability).toBeCloseTo(0.8)
    expect(hit?.probability).toBeCloseTo(0.2)
  })

  it('computes Cartesian product of per-group distributions', () => {
    const outcomes = getDiceOutcomes([
      [9, 1],
      [5, 1],
    ])
    // Group 0 (9+): 2 outcomes; Group 1 (5+): 2 outcomes → 4 total
    expect(outcomes).toHaveLength(4)

    const find = (hits: number[]) =>
      outcomes.find(
        o =>
          o.hits.length === hits.length &&
          o.hits.every((v, i) => v === hits[i]),
      )

    expect(find([0, 0])?.probability).toBeCloseTo(0.8 * 0.4)
    expect(find([0, 1])?.probability).toBeCloseTo(0.8 * 0.6)
    expect(find([1, 0])?.probability).toBeCloseTo(0.2 * 0.4)
    expect(find([1, 1])?.probability).toBeCloseTo(0.2 * 0.6)
  })

  it('preserves hit order per group with three groups', () => {
    const outcomes = getDiceOutcomes([
      [9, 1],
      [5, 1],
      [7, 1],
    ])
    // 2 * 2 * 2 = 8 outcomes
    expect(outcomes).toHaveLength(8)
    // Each hits array should have length 3
    for (const o of outcomes) {
      expect(o.hits).toHaveLength(3)
    }
  })

  it('probabilities sum to 1.0', () => {
    const outcomes = getDiceOutcomes([
      [9, 2],
      [5, 3],
      [7, 1],
    ])
    const sum = outcomes.reduce((acc, o) => acc + o.probability, 0)
    expect(sum).toBeCloseTo(1.0)
  })

  it('treats zero-count groups as deterministic zero hits', () => {
    const outcomes = getDiceOutcomes([
      [9, 0],
      [5, 1],
    ])
    // Group 0 has 0 dice → always 0 hits; group 1 has 2 outcomes
    expect(outcomes).toHaveLength(2)
    for (const o of outcomes) {
      expect(o.hits[0]).toBe(0)
    }
  })
})
