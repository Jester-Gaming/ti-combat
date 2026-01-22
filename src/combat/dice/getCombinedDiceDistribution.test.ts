import { describe, it, expect } from 'vitest'
import { getCombinedDiceDistribution } from './getCombinedDiceDistribution'

describe('getCombinedDiceDistribution', () => {
  it('returns zero hits with probability 1 for empty input', () => {
    const dist = getCombinedDiceDistribution([])
    expect(dist).toHaveLength(1)
    expect(dist[0]).toEqual({ hits: 0, probability: 1 })
  })

  it('returns same as single distribution for one group', () => {
    const dist = getCombinedDiceDistribution([[9, 1]])
    expect(dist.find(d => d.hits === 0)?.probability).toBeCloseTo(0.8)
    expect(dist.find(d => d.hits === 1)?.probability).toBeCloseTo(0.2)
  })

  it('combines two groups correctly', () => {
    // 1 die at 9+ (20% hit) + 1 die at 5+ (60% hit)
    const dist = getCombinedDiceDistribution([
      [9, 1],
      [5, 1],
    ])

    // Possible outcomes: 0+0, 0+1, 1+0, 1+1
    // 0 hits: 0.8 * 0.4 = 0.32
    // 1 hit: 0.8 * 0.6 + 0.2 * 0.4 = 0.48 + 0.08 = 0.56
    // 2 hits: 0.2 * 0.6 = 0.12
    expect(dist.find(d => d.hits === 0)?.probability).toBeCloseTo(0.32)
    expect(dist.find(d => d.hits === 1)?.probability).toBeCloseTo(0.56)
    expect(dist.find(d => d.hits === 2)?.probability).toBeCloseTo(0.12)
  })

  it('probabilities sum to 1.0', () => {
    const dist = getCombinedDiceDistribution([
      [9, 2],
      [5, 3],
      [7, 1],
    ])
    const sum = dist.reduce((acc, d) => acc + d.probability, 0)
    expect(sum).toBeCloseTo(1.0)
  })
})
