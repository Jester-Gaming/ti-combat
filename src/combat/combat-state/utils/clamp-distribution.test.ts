import { describe, expect, it } from 'vitest'

import { clampDistribution } from './clamp-distribution'

describe('clampDistribution', () => {
  it('returns the input reference when no clamping needed', () => {
    const dist = [
      { hits: 0, probability: 0.5 },
      { hits: 1, probability: 0.5 },
    ]
    expect(clampDistribution(dist, 5)).toBe(dist)
  })

  it('returns the input reference when length === cap + 1', () => {
    const dist = [
      { hits: 0, probability: 0.4 },
      { hits: 1, probability: 0.4 },
      { hits: 2, probability: 0.2 },
    ]
    expect(clampDistribution(dist, 2)).toBe(dist)
  })

  it('tail-folds probabilities into the cap entry', () => {
    const dist = [
      { hits: 0, probability: 0.1 },
      { hits: 1, probability: 0.2 },
      { hits: 2, probability: 0.3 },
      { hits: 3, probability: 0.25 },
      { hits: 4, probability: 0.15 },
    ]
    const out = clampDistribution(dist, 2)
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({ hits: 0, probability: 0.1 })
    expect(out[1]).toEqual({ hits: 1, probability: 0.2 })
    expect(out[2].hits).toBe(2)
    expect(out[2].probability).toBeCloseTo(0.3 + 0.25 + 0.15)
  })

  it('preserves total probability mass', () => {
    const dist = [
      { hits: 0, probability: 0.05 },
      { hits: 1, probability: 0.2 },
      { hits: 2, probability: 0.3 },
      { hits: 3, probability: 0.3 },
      { hits: 4, probability: 0.15 },
    ]
    const out = clampDistribution(dist, 1)
    const sum = out.reduce((acc, d) => acc + d.probability, 0)
    expect(sum).toBeCloseTo(1)
  })

  it('cap === 0 collapses to a single outcome with full probability', () => {
    const dist = [
      { hits: 0, probability: 0.4 },
      { hits: 1, probability: 0.4 },
      { hits: 2, probability: 0.2 },
    ]
    const out = clampDistribution(dist, 0)
    expect(out).toHaveLength(1)
    expect(out[0].hits).toBe(0)
    expect(out[0].probability).toBeCloseTo(1)
  })

  it('does not mutate the input array', () => {
    const dist = [
      { hits: 0, probability: 0.5 },
      { hits: 1, probability: 0.3 },
      { hits: 2, probability: 0.2 },
    ]
    const snapshot = dist.map(d => ({ ...d }))
    clampDistribution(dist, 1)
    expect(dist).toEqual(snapshot)
  })
})
