import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('INDOMITUS', () => {
  it('mech fires Space Cannon during SCO', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 2 } },
      defender: {
        faction: 'XXCHA_KINGDOM',
        units: { CRUISER: 1, MECH: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // Indomitus SC [8, 1]
    expect(pool.defender).toContainDice('MECH', [8, 1])
  })

  it('mech fires Space Cannon during SCD', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
      defender: {
        faction: 'XXCHA_KINGDOM',
        units: { MECH: 1, INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()

    // Indomitus SC [8, 1]
    expect(pool.defender).toContainDice('MECH', [8, 1])
  })
})
