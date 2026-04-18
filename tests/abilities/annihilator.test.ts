import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ANNIHILATOR', () => {
  it('mech bombards during main BOMBARDMENT phase', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 1, MECH: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    expect(pool.hitSource).toBe('BOMBARDMENT')
    // Main BOMBARDMENT — mech hasn't committed to ground combat yet, fires
    // alongside dreadnought.
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
    expect(pool.attacker).toContainDice('MECH', [8, 1])
  })
})
