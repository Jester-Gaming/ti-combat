import { describe, it, expect } from 'vitest'
import { getDiceDistribution } from './getDiceDistribution'

describe('getDiceDistribution', () => {
  it('probabilities sum to 1.0', () => {
    const dist = getDiceDistribution([5, 3])
    const sum = dist.reduce((acc, d) => acc + d.probability, 0)
    expect(sum).toBeCloseTo(1.0)
  })

  it('calculates correct probabilities for 2 dice at hit 5+', () => {
    // Hit on 5+ = 6/10 = 0.6, miss = 0.4
    const dist = getDiceDistribution([5, 2])
    expect(dist.find(d => d.hits === 0)?.probability).toBeCloseTo(0.16)
    expect(dist.find(d => d.hits === 1)?.probability).toBeCloseTo(0.48)
    expect(dist.find(d => d.hits === 2)?.probability).toBeCloseTo(0.36)
  })

  it('calculates correct probabilities for hit 9+ (20% chance)', () => {
    const dist = getDiceDistribution([9, 1])
    expect(dist.find(d => d.hits === 0)?.probability).toBeCloseTo(0.8)
    expect(dist.find(d => d.hits === 1)?.probability).toBeCloseTo(0.2)
  })

  it('returns single zero-hit outcome for 0 dice', () => {
    const dist = getDiceDistribution([5, 0])
    expect(dist).toHaveLength(1)
    expect(dist[0]).toEqual({ hits: 0, probability: 1 })
  })
})
