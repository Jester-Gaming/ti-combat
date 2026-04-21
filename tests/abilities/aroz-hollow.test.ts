import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('AROZ_HOLLOW', () => {
  it('applies -1 hit value to all combat dice', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, DREADNOUGHT: 1 },
        abilities: { AROZ_HOLLOW: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser: 7 - 1(Aroz Hollow) = 6
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
    // Dreadnought: 5 - 1(Aroz Hollow) = 4
    expect(pool.attacker).toContainDice('DREADNOUGHT', [4, 1])
  })
})
