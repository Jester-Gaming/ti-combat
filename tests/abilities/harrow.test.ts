import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('HARROW', () => {
  it('resolves a bombardment step at end of each ground combat round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 2, INFANTRY: 1 },
        abilities: { HARROW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceToTiming('END_OF_COMBAT_ROUND', { attacker: 0, defender: 0 })
    expect(t.defender.units.INFANTRY).toHaveLength(3)

    t.advanceToTiming('AFTER_COMBAT_ROUND', { attacker: 0, defender: 2 })
    expect(t.dicePool().hitSource).toBe('BOMBARDMENT')
    expect(t.abilityLog('HARROW')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })

  it('still fires when attacker loses all ground forces in the same round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 2, INFANTRY: 1 },
        abilities: { HARROW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT', { attacker: 0, defender: 0 })

    t.advanceToTiming('END_OF_COMBAT', { attacker: 1, defender: 0 })
    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.defender.units.INFANTRY).toHaveLength(3)

    t.advanceTo('COMPLETE', { attacker: 0, defender: 2 })

    expect(t.abilityLog('HARROW')).not.toHaveLength(0)
    expect(t.dicePool().hitSource).toBe('BOMBARDMENT')
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })

  it('flips outcome to draw when its bombardment wipes the opponent after attacker loss', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 2, INFANTRY: 1 },
        abilities: { HARROW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', { attacker: 0, defender: 0 })
    t.advanceToTiming('END_OF_COMBAT', { attacker: 1, defender: 0 })

    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.state.winnerSide).toBe('defender')

    t.advanceTo('COMPLETE', { attacker: 0, defender: 2 })

    expect(t.defender.units.INFANTRY).toBeUndefined()
    expect(t.state.winnerSide).toBe('draw')
  })
})
