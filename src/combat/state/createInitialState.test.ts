import { describe, it, expect } from 'vitest'
import { createInitialCombatState } from './createInitialState'
import type { UnitStats } from '@/types'

describe('createInitialCombatState', () => {
  const fighterStats: UnitStats = { COMBAT: [9, 1], ABILITIES: {} }
  const dreadnoughtStats: UnitStats = {
    COMBAT: [5, 1],
    ABILITIES: { SUSTAIN_DAMAGE: true },
  }

  it('creates units grouped by type', () => {
    const state = createInitialCombatState(
      { FIGHTER: fighterStats },
      { FIGHTER: 3 },
      {},
      {},
    )

    expect(state.attacker.units.FIGHTER).toHaveLength(3)
    expect(state.attacker.units.FIGHTER![0]).toEqual({})
  })

  it('stores stats on side state', () => {
    const state = createInitialCombatState(
      { FIGHTER: fighterStats },
      { FIGHTER: 2 },
      { DREADNOUGHT: dreadnoughtStats },
      { DREADNOUGHT: 1 },
    )

    expect(state.attacker.stats.FIGHTER).toBe(fighterStats)
    expect(state.defender.stats.DREADNOUGHT).toBe(dreadnoughtStats)
  })

  it('creates units for both sides', () => {
    const state = createInitialCombatState(
      { FIGHTER: fighterStats },
      { FIGHTER: 2 },
      { DREADNOUGHT: dreadnoughtStats },
      { DREADNOUGHT: 1 },
    )

    expect(state.attacker.units.FIGHTER).toHaveLength(2)
    expect(state.defender.units.DREADNOUGHT).toHaveLength(1)
  })

  it('initializes round to 1', () => {
    const state = createInitialCombatState({}, {}, {}, {})
    expect(state.round).toBe(1)
  })

  it('initializes pending hits to 0', () => {
    const state = createInitialCombatState(
      { FIGHTER: fighterStats },
      { FIGHTER: 1 },
      { FIGHTER: fighterStats },
      { FIGHTER: 1 },
    )
    expect(state.attacker.pendingHits).toBe(0)
    expect(state.defender.pendingHits).toBe(0)
  })
})
