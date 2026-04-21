import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BUNKER + HARROW', () => {
  it('Bunker applies +4 to Harrow bombardment dice', () => {
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
        abilities: { BUNKER: true },
      },
    })

    t.advanceToTiming(
      'END_OF_COMBAT_ROUND',
      { attacker: 0, defender: 0 },
      'GROUND_COMBAT',
    )
    t.advanceRound({ attacker: 0, defender: 0 })

    // Last DICE_POOL is Harrow's resolveStep BOMBARDMENT.
    // Dreadnought bombardment [5, 1] + 4 (Bunker) = [9, 1].
    const pool = t.dicePool()
    expect(pool.hitSource).toBe('BOMBARDMENT')
    expect(pool.attacker).toContainDice('DREADNOUGHT', [9, 1])
  })
})
