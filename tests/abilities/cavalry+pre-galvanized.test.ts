import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('CAVALRY + PRE_GALVANIZED', () => {
  it('preserves the galvanize bonus die when Cavalry overwrites combat stats', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: { CRUISER: 1 },
          },
          CAVALRY: { isEnabled: true, unitType: 'CRUISER:Galvanized' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    const pool = t.dicePool()
    // Cavalry replaces COMBAT with Nomad flagship [7, 2] but preserves parent
    // bonus dice: galvanize (+1) -> [7, 2, 1] = effective [7, 3]
    expect(pool.attacker).toContainDice('CRUISER', [7, 3])
  })
})
