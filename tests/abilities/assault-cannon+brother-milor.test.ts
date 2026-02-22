import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ASSAULT_CANNON + BROTHER_MILOR', () => {
  it('does not fire when Assault Cannon destroys opponent ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { ASSAULT_CANNON: true, BROTHER_MILOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    // Assault Cannon destroys 1 defender cruiser — but it's opponent's unit
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.defender.units.CRUISER).toHaveLength(2)
    expect(t.abilityLog('BROTHER_MILOR')).toHaveLength(0) // Not our unit
  })
})
