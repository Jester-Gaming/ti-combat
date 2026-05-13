import { describe, expect, it } from 'vitest'

import { reconcileUnitListParam } from './reconcile-helpers'

describe('reconcileUnitListParam — limit clamp', () => {
  it('clamps numeric values when maxFor returns a finite max', () => {
    const result = reconcileUnitListParam(
      [
        ['CRUISER', 8],
        ['DREADNOUGHT', 4],
      ],
      ['CRUISER', 'DREADNOUGHT'],
      0,
      key => (key === 'CRUISER' ? 3 : 5),
    )
    expect(result).toEqual([
      ['CRUISER', 3],
      ['DREADNOUGHT', 4],
    ])
  })

  it('leaves non-number tuple values untouched even with a maxFor', () => {
    const result = reconcileUnitListParam(
      [['CRUISER', true], ['DREADNOUGHT']],
      ['CRUISER', 'DREADNOUGHT'],
      undefined,
      () => 0,
    )
    expect(result).toEqual([['CRUISER', true], ['DREADNOUGHT']])
  })

  it('treats Infinity from maxFor as no clamp', () => {
    const result = reconcileUnitListParam(
      [['CRUISER', 8]],
      ['CRUISER'],
      0,
      () => Infinity,
    )
    expect(result).toEqual([['CRUISER', 8]])
  })

  it('newly-inserted entries are also clamped', () => {
    const result = reconcileUnitListParam([], ['CRUISER'], 99, () => 3)
    expect(result).toEqual([['CRUISER', 3]])
  })
})
