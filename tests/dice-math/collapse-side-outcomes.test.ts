import { describe, expect, it } from 'vitest'

import { collapseSideOutcomes } from '@/combat/dice-math/phases/collapse-side-outcomes'

interface Outcome {
  probability: number
  total: number
}

const totalHits = (o: Outcome) => o.total

function sumProb(outcomes: Outcome[]): number {
  return outcomes.reduce((s, o) => s + o.probability, 0)
}

describe('collapseSideOutcomes', () => {
  it('returns input as-is when only one outcome', () => {
    const input: Outcome[] = [{ probability: 1, total: 3 }]
    const out = collapseSideOutcomes(input, totalHits, 1e-6)
    expect(out).toHaveLength(1)
    expect(out[0].probability).toBe(1)
    expect(out[0].total).toBe(3)
  })

  it('does nothing when threshold is 0', () => {
    const input: Outcome[] = [
      { probability: 1e-12, total: 0 },
      { probability: 0.5, total: 1 },
      { probability: 0.5 - 1e-12, total: 2 },
    ]
    const out = collapseSideOutcomes(input, totalHits, 0)
    expect(out).toHaveLength(3)
  })

  it('merges single low-tail outcome into next total', () => {
    const input: Outcome[] = [
      { probability: 1e-9, total: 0 },
      { probability: 0.3, total: 1 },
      { probability: 0.7 - 1e-9, total: 2 },
    ]
    const out = collapseSideOutcomes(input, totalHits, 1e-6)
    expect(out.map(o => o.total).sort()).toEqual([1, 2])
    const at1 = out.find(o => o.total === 1)!
    expect(at1.probability).toBeCloseTo(0.3 + 1e-9, 15)
    expect(sumProb(out)).toBeCloseTo(1, 15)
  })

  it('merges multiple consecutive low-tail outcomes iteratively', () => {
    const input: Outcome[] = [
      { probability: 1e-12, total: 0 },
      { probability: 1e-9, total: 1 },
      { probability: 0.4, total: 2 },
      { probability: 0.6 - 1e-12 - 1e-9, total: 3 },
    ]
    const out = collapseSideOutcomes(input, totalHits, 1e-6)
    expect(out.map(o => o.total).sort()).toEqual([2, 3])
    expect(sumProb(out)).toBeCloseTo(1, 15)
  })

  it('collapses both tails symmetrically', () => {
    const input: Outcome[] = [
      { probability: 1e-9, total: 0 },
      { probability: 0.5 - 1e-9, total: 1 },
      { probability: 0.5 - 1e-9, total: 2 },
      { probability: 1e-9, total: 3 },
    ]
    const out = collapseSideOutcomes(input, totalHits, 1e-6)
    expect(out.map(o => o.total).sort()).toEqual([1, 2])
    expect(sumProb(out)).toBeCloseTo(1, 15)
  })

  it('leaves interior outcomes below threshold untouched (only tails collapse)', () => {
    const input: Outcome[] = [
      { probability: 1e-9, total: 0 },
      { probability: 0.5 - 1e-9, total: 1 },
      { probability: 0.05, total: 2 },
      { probability: 0.45 - 1e-9, total: 3 },
      { probability: 1e-9, total: 4 },
    ]
    const out = collapseSideOutcomes(input, totalHits, 1e-6)
    expect(out.map(o => o.total).sort((a, b) => a - b)).toEqual([1, 2, 3])
    const at2 = out.find(o => o.total === 2)!
    expect(at2.probability).toBe(0.05)
    expect(sumProb(out)).toBeCloseTo(1, 15)
  })

  it('distributes collapsed mass proportionally across outcomes at the same next total', () => {
    const input: Outcome[] = [
      { probability: 1e-9, total: 0 },
      { probability: 0.3, total: 1 },
      { probability: 0.1, total: 1 },
      { probability: 0.6 - 1e-9, total: 2 },
    ]
    const out = collapseSideOutcomes(input, totalHits, 1e-6)
    const at1 = out.filter(o => o.total === 1)
    expect(at1).toHaveLength(2)
    const big = at1.find(o => o.probability > 0.2)!
    const small = at1.find(o => o.probability < 0.2)!
    expect(big.probability).toBeCloseTo(0.3 + 1e-9 * (0.3 / 0.4), 15)
    expect(small.probability).toBeCloseTo(0.1 + 1e-9 * (0.1 / 0.4), 15)
    expect(sumProb(out)).toBeCloseTo(1, 15)
  })

  it('does not mutate the input array or its elements', () => {
    const input: Outcome[] = [
      { probability: 1e-9, total: 0 },
      { probability: 1 - 1e-9, total: 1 },
    ]
    const snapshot = input.map(o => ({ ...o }))
    collapseSideOutcomes(input, totalHits, 1e-6)
    expect(input).toEqual(snapshot)
  })
})
