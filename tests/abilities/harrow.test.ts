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

  it('does not fire when attacker has no bombardment-capable units', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { INFANTRY: 2 },
        abilities: { HARROW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('HARROW')).toHaveLength(0)
  })
})
