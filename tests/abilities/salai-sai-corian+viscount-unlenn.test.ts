import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('SALAI_SAI_CORIAN + VISCOUNT_UNLENN', () => {
  it('Viscount adds 1 die on top of Salai dynamic dice count', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { FLAGSHIP: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'FLAGSHIP' },
        },
      },
      // 2 non-fighter ships for Salai to count
      defender: { faction: 'ARBOREC', units: { CRUISER: 1, DREADNOUGHT: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    expect(t.abilityLog('VISCOUNT_UNLENN')).not.toHaveLength(0)

    const pool = t.dicePool()
    // Salai Sai Corian: dice = opponent non-fighter ships = 2, hit value 7
    // Viscount adds 1 die: [7, 3]
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 3])
  })
})
