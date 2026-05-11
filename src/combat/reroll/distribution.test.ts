import { describe, expect, it } from 'vitest'

import type { GroupShape, JointDist } from './distribution'
import {
  applyAllReroll,
  applyHitsReroll,
  applyMissesReroll,
  binomialPmf,
  buildInitialJoint,
  decodeKey,
  encodeKey,
  marginalTotal,
} from './distribution'

const shape = (N: number, p: number): GroupShape => ({ N, p })

describe('binomialPmf', () => {
  it('Bin(n, p) sums to 1 over k=0..n', () => {
    let s = 0
    for (let k = 0; k <= 5; k++) s += binomialPmf(5, 0.3, k)
    expect(s).toBeCloseTo(1, 12)
  })

  it('Bin(2, 0.5) gives 0.25 / 0.5 / 0.25', () => {
    expect(binomialPmf(2, 0.5, 0)).toBeCloseTo(0.25, 12)
    expect(binomialPmf(2, 0.5, 1)).toBeCloseTo(0.5, 12)
    expect(binomialPmf(2, 0.5, 2)).toBeCloseTo(0.25, 12)
  })

  it('out-of-range k returns 0', () => {
    expect(binomialPmf(3, 0.5, -1)).toBe(0)
    expect(binomialPmf(3, 0.5, 4)).toBe(0)
  })
})

describe('buildInitialJoint', () => {
  it('single group: marginal matches binomial', () => {
    const j = buildInitialJoint([shape(2, 0.5)])
    expect(j.cells.get('0')).toBeCloseTo(0.25, 12)
    expect(j.cells.get('1')).toBeCloseTo(0.5, 12)
    expect(j.cells.get('2')).toBeCloseTo(0.25, 12)
  })

  it('two groups: independent product', () => {
    const j = buildInitialJoint([shape(1, 0.5), shape(1, 0.5)])
    expect(j.cells.get('0,0')).toBeCloseTo(0.25, 12)
    expect(j.cells.get('0,1')).toBeCloseTo(0.25, 12)
    expect(j.cells.get('1,0')).toBeCloseTo(0.25, 12)
    expect(j.cells.get('1,1')).toBeCloseTo(0.25, 12)
  })

  it('mass sums to 1', () => {
    const j = buildInitialJoint([shape(3, 0.3), shape(2, 0.7)])
    let s = 0
    for (const v of j.cells.values()) s += v
    expect(s).toBeCloseTo(1, 12)
  })
})

describe('marginalTotal', () => {
  it('returns distribution over sum of group hits', () => {
    const j = buildInitialJoint([shape(1, 0.5), shape(1, 0.5)])
    const m = marginalTotal(j)
    expect(m.get(0)).toBeCloseTo(0.25, 12)
    expect(m.get(1)).toBeCloseTo(0.5, 12)
    expect(m.get(2)).toBeCloseTo(0.25, 12)
  })
})

describe('applyMissesReroll', () => {
  it('1 die p=0.2: P_hit becomes 0.36', () => {
    const j = buildInitialJoint([shape(1, 0.2)])
    const j2 = applyMissesReroll(j, [shape(1, 0.2)])
    expect(j2.cells.get('0')).toBeCloseTo(0.64, 12)
    expect(j2.cells.get('1')).toBeCloseTo(0.36, 12)
  })

  it('preserves total mass', () => {
    const j = buildInitialJoint([shape(5, 0.3), shape(3, 0.5)])
    const j2 = applyMissesReroll(j, [shape(5, 0.3), shape(3, 0.5)])
    let s = 0
    for (const v of j2.cells.values()) s += v
    expect(s).toBeCloseTo(1, 12)
  })
})

describe('applyHitsReroll', () => {
  it('1 die p=0.5: hits get rerolled, P_hit becomes 0.25', () => {
    const j = buildInitialJoint([shape(1, 0.5)])
    const j2 = applyHitsReroll(j, [shape(1, 0.5)])
    expect(j2.cells.get('1')).toBeCloseTo(0.25, 12)
    expect(j2.cells.get('0')).toBeCloseTo(0.75, 12)
  })
})

describe('applyAllReroll', () => {
  it('discards prior outcome and returns fresh binomial', () => {
    const j: JointDist = { groupCount: 1, cells: new Map([['1', 1.0]]) }
    const j2 = applyAllReroll(j, [shape(1, 0.5)])
    expect(j2.cells.get('0')).toBeCloseTo(0.5, 12)
    expect(j2.cells.get('1')).toBeCloseTo(0.5, 12)
  })
})

describe('empty-groups side', () => {
  it('encodeKey([]) and decodeKey roundtrip to []', () => {
    expect(encodeKey([])).toBe('')
    expect(decodeKey('')).toEqual([])
  })

  it('buildInitialJoint([]) yields a single empty-key cell', () => {
    const j = buildInitialJoint([])
    expect(j.cells.size).toBe(1)
    expect(j.cells.get('')).toBeCloseTo(1, 12)
  })

  it('applyMissesReroll on empty groups preserves the single cell', () => {
    const j = buildInitialJoint([])
    const j2 = applyMissesReroll(j, [])
    expect(j2.cells.size).toBe(1)
    expect(j2.cells.get('')).toBeCloseTo(1, 12)
  })
})
