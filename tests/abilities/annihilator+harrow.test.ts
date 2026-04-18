import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ANNIHILATOR + HARROW', () => {
  it('mech does NOT bombard under Harrow (committed to ground combat)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'L1Z1X_MINDNET',
        units: { DREADNOUGHT: 1, MECH: 1, INFANTRY: 1 },
        abilities: { HARROW: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'END', { attacker: 0, defender: 0 })
    t.advanceRound({ attacker: 0, defender: 0 })

    // Last DICE_POOL is Harrow's resolveStep BOMBARDMENT. The mech is now
    // participating in ground combat, so Annihilator's cannotBeUsed
    // restriction keeps it out — dreadnought is the only contributor.
    const pool = t.dicePool()
    expect(pool.hitSource).toBe('BOMBARDMENT')
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
    expect(pool.attacker).not.toContainDice('MECH')
  })
})
