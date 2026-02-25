import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('VISCOUNT_UNLENN + VISZ_EL_VIR', () => {
  it('Visz El Vir +1 die and Viscount +1 die stack on Eidolon mech', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { FLAGSHIP: 1, MECH: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'MECH' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    expect(t.abilityLog('VISCOUNT_UNLENN')).not.toHaveLength(0)

    const pool = t.dicePool()
    // Z-Grav Eidolon base: [8, 2]
    // Visz El Vir: +1 die -> [8, 3]
    // Viscount: +1 die -> [8, 4]
    expect(pool.attacker).toContainDice('MECH', [8, 4])
  })
})
