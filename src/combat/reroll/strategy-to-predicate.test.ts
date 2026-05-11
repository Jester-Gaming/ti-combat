import { describe, expect, it } from 'vitest'

import { strategyToPredicate } from './strategy-to-predicate'
import type { RerollSide } from './types'

const side = (
  total: number,
  distribution: { hits: number; probability: number }[] = [],
): RerollSide => ({ groups: [], total, distribution })

describe('strategyToPredicate', () => {
  it('NEVER → always false', () => {
    const p = strategyToPredicate({ kind: 'NEVER' }, 'own')
    expect(p(side(0))).toBe(false)
    expect(p(side(10))).toBe(false)
  })

  it('ALWAYS → always true', () => {
    const p = strategyToPredicate({ kind: 'ALWAYS' }, 'own')
    expect(p(side(0))).toBe(true)
    expect(p(side(10))).toBe(true)
  })

  it('IF_HITS_LE: triggers when total is at or below threshold', () => {
    const p = strategyToPredicate({ kind: 'IF_HITS_LE', threshold: 3 }, 'own')
    expect(p(side(0))).toBe(true)
    expect(p(side(3))).toBe(true)
    expect(p(side(4))).toBe(false)
  })

  it('IF_HITS_GE: triggers when total is at or above threshold', () => {
    const p = strategyToPredicate({ kind: 'IF_HITS_GE', threshold: 3 }, 'own')
    expect(p(side(2))).toBe(false)
    expect(p(side(3))).toBe(true)
    expect(p(side(10))).toBe(true)
  })

  it('IF_BAD_OUTCOME own: triggers when result is in the bad tail', () => {
    const dist = [
      { hits: 0, probability: 0.1 },
      { hits: 1, probability: 0.3 },
      { hits: 2, probability: 0.6 },
    ]
    const p = strategyToPredicate({ kind: 'IF_BAD_OUTCOME', pct: 50 }, 'own')
    expect(p(side(0, dist))).toBe(true)
    expect(p(side(1, dist))).toBe(true)
    expect(p(side(2, dist))).toBe(false)
  })

  it('IF_BAD_OUTCOME opponent: triggers when opponent rolled in their bad tail', () => {
    const dist = [
      { hits: 0, probability: 0.6 },
      { hits: 1, probability: 0.3 },
      { hits: 2, probability: 0.1 },
    ]
    const p = strategyToPredicate(
      { kind: 'IF_BAD_OUTCOME', pct: 50 },
      'opponent',
    )
    expect(p(side(2, dist))).toBe(true)
    expect(p(side(1, dist))).toBe(true)
    expect(p(side(0, dist))).toBe(false)
  })
})
