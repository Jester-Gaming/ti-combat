import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('PRE_GALVANIZED + VISCOUNT_UNLENN', () => {
  it('stacks both bonus dice on the same unit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { CRUISER: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: { CRUISER: 1 },
          },
          VISCOUNT_UNLENN: {
            isEnabled: true,
            unitType: 'CRUISER:Galvanized',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    const pool = t.dicePool()
    // Cruiser: [7, 1] + galvanize (+1) + Viscount (+1) -> [7, 3]
    expect(pool.attacker).toContainDice('CRUISER', [7, 3])
  })
})
