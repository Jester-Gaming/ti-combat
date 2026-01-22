import { describe, it, expect } from 'vitest'
import { destroyUnits } from './destroyUnits'
import type { CombatSideState } from '../types'
import type { UnitStats } from '@/types'

describe('destroyUnits', () => {
  const fighterStats: UnitStats = { COMBAT: [9, 1], ABILITIES: {} }
  const cruiserStats: UnitStats = { COMBAT: [7, 1], ABILITIES: {} }

  const makeSide = (
    unitCounts: Partial<Record<string, number>>,
    pendingHits = 0,
  ): CombatSideState => {
    const units: CombatSideState['units'] = {}
    const stats: CombatSideState['stats'] = {}

    for (const [type, count] of Object.entries(unitCounts)) {
      if (count && count > 0) {
        units[type as keyof typeof units] = Array.from(
          { length: count },
          () => ({}),
        )
        stats[type as keyof typeof stats] =
          type === 'FIGHTER' ? fighterStats : cruiserStats
      }
    }

    return { stats, units, pendingHits }
  }

  it('returns state unchanged when no pending hits', () => {
    const state = makeSide({ FIGHTER: 2 }, 0)
    const result = destroyUnits(state)
    expect(result).toBe(state)
  })

  it('destroys cheapest units first', () => {
    const state = makeSide({ FIGHTER: 2, CRUISER: 2 }, 2)
    const result = destroyUnits(state)

    expect(result.units.FIGHTER).toBeUndefined()
    expect(result.units.CRUISER).toHaveLength(2)
    expect(result.pendingHits).toBe(0)
  })

  it('destroys all units if hits exceed unit count', () => {
    const state = makeSide({ FIGHTER: 2 }, 5)
    const result = destroyUnits(state)

    expect(result.units.FIGHTER).toBeUndefined()
    expect(result.pendingHits).toBe(3)
  })

  it('respects validTargets filter', () => {
    const state = makeSide({ FIGHTER: 2, CRUISER: 2 }, 3)
    const result = destroyUnits(state, ['FIGHTER'])

    expect(result.units.FIGHTER).toBeUndefined()
    expect(result.units.CRUISER).toHaveLength(2)
    expect(result.pendingHits).toBe(1)
  })

  it('handles mixed unit types with sacrifice order', () => {
    const state = makeSide({ CRUISER: 1, FIGHTER: 1 }, 1)
    const result = destroyUnits(state)

    expect(result.units.FIGHTER).toBeUndefined()
    expect(result.units.CRUISER).toHaveLength(1)
  })

  it('preserves stats reference', () => {
    const state = makeSide({ FIGHTER: 2 }, 1)
    const result = destroyUnits(state)

    expect(result.stats).toBe(state.stats)
  })

  it('handles empty units', () => {
    const state: CombatSideState = { stats: {}, units: {}, pendingHits: 2 }
    const result = destroyUnits(state)

    expect(result.pendingHits).toBe(2)
  })

  it('removes empty unit arrays from result', () => {
    const state = makeSide({ FIGHTER: 1 }, 1)
    const result = destroyUnits(state)

    expect(Object.keys(result.units)).not.toContain('FIGHTER')
  })
})
