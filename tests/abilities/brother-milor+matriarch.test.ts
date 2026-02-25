import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BROTHER_MILOR + MATRIARCH', () => {
  it('places 2 infantry when the only committed fighter is destroyed', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 1 },
        abilities: {
          BROTHER_MILOR: { isEnabled: true, uses: 1 },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Attacker receives 1 hit — fighter destroyed, Brother Milor fires
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('BROTHER_MILOR')).not.toHaveLength(0)
    // Fighter destroyed → 2 infantry placed
    expect(t.attacker.units.FIGHTER).toBeUndefined()
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })
})
