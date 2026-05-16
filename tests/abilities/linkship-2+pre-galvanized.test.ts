import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('LINKSHIP_2 + PRE_GALVANIZED', () => {
  it('rolls the Galvanized PDS SC dice (with the +1 bonus die)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: { DESTROYER: 1, PDS: 1 },
        upgrades: ['DESTROYER'],
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['PDS', 1]],
          },
          LINKSHIP_2: { structures: [['PDS:Galvanized', 1]] },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // Linkship II triggers SC off a Galvanized PDS — must roll the galvanized
    // SC [6, 1, 1] (base+bonus = 2 dice total), not the base PDS [6, 1].
    expect(pool.defender.DESTROYER).toHaveLength(1)
    expect(pool.defender).toContainDice('DESTROYER', [6, 2])
  })
})
