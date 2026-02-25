import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TWO_RAM', () => {
  it('strips Planetary Shield so bombardment can fire', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
        abilities: { TWO_RAM: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // 2RAM strips PS at PREPARE; dreadnought bombardment fires through
    // Dreadnought bombardment: [5, 1]
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
  })
})
