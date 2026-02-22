import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EIDOLON_MAXIMUM + VISZ_EL_VIR', () => {
  it('flagship adds 1 die to mech in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { FLAGSHIP: 1, MECH: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Eidolon Maximum: [4, 4] + Visz El Vir: +1 die = [4, 5]
    expect(pool.attacker).toContainDice('MECH', [4, 5])
  })
})
