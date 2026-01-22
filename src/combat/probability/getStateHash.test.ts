import { describe, it, expect } from 'vitest'
import { getStateHash } from './getStateHash'
import type { CombatState, CombatSideState, Unit } from '../types'
import type { UnitStats } from '@/types'

describe('getStateHash', () => {
  const fighterStats: UnitStats = { COMBAT: [9, 1], ABILITIES: {} }
  const cruiserStats: UnitStats = { COMBAT: [7, 1], ABILITIES: {} }

  const makeSide = (
    units: Partial<Record<string, Unit[]>>,
  ): CombatSideState => ({
    stats: { FIGHTER: fighterStats, CRUISER: cruiserStats },
    units: units as CombatSideState['units'],
    pendingHits: 0,
  })

  const makeState = (
    attackerUnits: Partial<Record<string, Unit[]>>,
    defenderUnits: Partial<Record<string, Unit[]>>,
  ): CombatState => ({
    attacker: makeSide(attackerUnits),
    defender: makeSide(defenderUnits),
    round: 1,
  })

  it('returns same hash for identical states', () => {
    const state1 = makeState({ FIGHTER: [{}, {}] }, { CRUISER: [{}] })
    const state2 = makeState({ FIGHTER: [{}, {}] }, { CRUISER: [{}] })

    expect(getStateHash(state1)).toBe(getStateHash(state2))
  })

  it('returns different hash for different unit counts', () => {
    const state1 = makeState({ FIGHTER: [{}, {}] }, { CRUISER: [{}] })
    const state2 = makeState({ FIGHTER: [{}] }, { CRUISER: [{}] })

    expect(getStateHash(state1)).not.toBe(getStateHash(state2))
  })

  it('returns different hash for different sides', () => {
    const state1 = makeState({ FIGHTER: [{}] }, { CRUISER: [{}] })
    const state2 = makeState({ CRUISER: [{}] }, { FIGHTER: [{}] })

    expect(getStateHash(state1)).not.toBe(getStateHash(state2))
  })

  it('returns different hash for different unit states', () => {
    const state1 = makeState({ DREADNOUGHT: [{}, {}] }, {})
    const state2 = makeState(
      { DREADNOUGHT: [{}, { sustained: true } as Unit] },
      {},
    )

    expect(getStateHash(state1)).not.toBe(getStateHash(state2))
  })

  it('handles empty units', () => {
    const state = makeState({}, {})
    expect(getStateHash(state)).toBe('|')
  })
})
