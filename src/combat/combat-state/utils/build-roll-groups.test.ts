import { describe, expect, it } from 'vitest'

import type { UnitId } from '@/types'

import type { DicePool } from '../../abilities-engine/types'
import { buildRollGroups } from './build-roll-groups'

describe('buildRollGroups', () => {
  it('groups identical units (same variantKey, hitValue, dicePerUnit)', () => {
    const u1 = 'a' as UnitId
    const u2 = 'b' as UnitId
    const u3 = 'c' as UnitId
    const pool: DicePool = {
      CRUISER: [
        [7, 1, 0, u1],
        [7, 1, 0, u2],
      ],
      DESTROYER: [[9, 1, 0, u3]],
    }
    const groups = buildRollGroups(pool, {
      variantKeyOf: id => (id === u3 ? 'DESTROYER' : 'CRUISER'),
    })
    expect(groups).toHaveLength(2)
    const cruiser = groups.find(g => g.variantKey === 'CRUISER')!
    expect(cruiser.units).toEqual([u1, u2])
    expect(cruiser.dicePerUnit).toBe(1)
    expect(cruiser.hitValue).toBe(7)
    expect(cruiser.source).toBe('CRUISER')
    const destroyer = groups.find(g => g.variantKey === 'DESTROYER')!
    expect(destroyer.units).toEqual([u3])
  })

  it('keeps distinct variantKeys as separate groups', () => {
    const u1 = 'a' as UnitId
    const u2 = 'b' as UnitId
    const pool: DicePool = {
      CRUISER: [
        [7, 1, 0, u1],
        [7, 1, 0, u2],
      ],
    }
    const groups = buildRollGroups(pool, {
      variantKeyOf: id => (id === u1 ? 'CRUISER' : 'CRUISER:Cavalry'),
    })
    expect(groups).toHaveLength(2)
    expect(groups.find(g => g.variantKey === 'CRUISER:Cavalry')?.source).toBe(
      'CRUISER',
    )
  })

  it('combines base + bonus dice into dicePerUnit', () => {
    const u1 = 'a' as UnitId
    const pool: DicePool = {
      WAR_SUN: [[3, 3, 1, u1]],
    }
    const groups = buildRollGroups(pool, { variantKeyOf: () => 'WAR_SUN' })
    expect(groups).toHaveLength(1)
    expect(groups[0].dicePerUnit).toBe(4)
  })

  it('skips units with zero dice', () => {
    const u1 = 'a' as UnitId
    const pool: DicePool = {
      CRUISER: [[7, 0, 0, u1]],
    }
    const groups = buildRollGroups(pool, { variantKeyOf: () => 'CRUISER' })
    expect(groups).toHaveLength(0)
  })

  it('separates units with same variantKey but different hitValue', () => {
    const u1 = 'a' as UnitId
    const u2 = 'b' as UnitId
    const pool: DicePool = {
      CRUISER: [
        [7, 1, 0, u1],
        [6, 1, 0, u2],
      ],
    }
    const groups = buildRollGroups(pool, { variantKeyOf: () => 'CRUISER' })
    expect(groups).toHaveLength(2)
  })
})
