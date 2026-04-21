import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BROTHER_MILOR + HARROW', () => {
  it('defender places 2 infantry when Harrow bombardment destroys ground forces', () => {
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
        abilities: { BROTHER_MILOR: true },
      },
    })

    t.advanceToTiming(
      'END_OF_COMBAT_ROUND',
      { attacker: 0, defender: 0 },
      'GROUND_COMBAT',
    )
    // Harrow resolves BOMBARDMENT; dreadnoughts [5,2] destroy 2 infantry
    t.advanceRound({ attacker: 0, defender: 2 })

    expect(t.abilityLog('HARROW')).not.toHaveLength(0)
    // Verify bombardment actually destroyed defender infantry (3 → 1)
    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
    // 3 - 2 (destroyed by Harrow) + 2 (placed by Milor) = 3
    expect(t.defender.units.INFANTRY).toHaveLength(3)
  })
})
