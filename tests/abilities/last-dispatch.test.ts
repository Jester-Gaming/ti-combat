import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('LAST_DISPATCH', () => {
  it('destroys 1 opponent ship without sustain when flagship retreats', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'RAL_NEL',
        units: { FLAGSHIP: 1, CRUISER: 2 },
        abilities: {
          RETREAT: { isEnabled: true, rounds: 1 },
          LAST_DISPATCH: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.isFinished()).toBe(true)
    expect(t.abilityLog('LAST_DISPATCH')).toHaveLength(1)
    // One opponent cruiser destroyed by Last Dispatch
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })

  it('respects target priority among eligible ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'RAL_NEL',
        units: { FLAGSHIP: 1 },
        abilities: {
          RETREAT: { isEnabled: true, rounds: 1 },
          LAST_DISPATCH: {
            isEnabled: true,
            targetPriority: ['FIGHTER', 'DESTROYER'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1, FIGHTER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.isFinished()).toBe(true)
    expect(t.abilityLog('LAST_DISPATCH')).toHaveLength(1)
    // Fighter is higher priority than destroyer
    expect(t.defender.units.FIGHTER ?? []).toHaveLength(0)
    expect(t.defender.units.DESTROYER).toHaveLength(1)
  })

  it('does not fire when no eligible targets (all have active sustain)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'RAL_NEL',
        units: { FLAGSHIP: 1 },
        abilities: {
          RETREAT: { isEnabled: true, rounds: 1 },
          LAST_DISPATCH: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
        abilities: { SUSTAIN_DAMAGE: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.isFinished()).toBe(true)
    expect(t.abilityLog('LAST_DISPATCH')).toHaveLength(0)
  })

  it('does not fire when flagship is not in combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'RAL_NEL',
        units: { CRUISER: 3 },
        abilities: {
          RETREAT: { isEnabled: true, rounds: 1 },
          LAST_DISPATCH: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.isFinished()).toBe(true)
    expect(t.abilityLog('LAST_DISPATCH')).toHaveLength(0)
  })
})
