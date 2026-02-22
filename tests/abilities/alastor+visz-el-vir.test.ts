import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ALASTOR + VISZ_EL_VIR', () => {
  it('adds extra dice per mech participating via Alastor', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 2 },
        abilities: { VISZ_EL_VIR: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Each mech gets +1 die from Visz El Vir
    // Mordred mech base: [6, 1] → [6, 2] per mech
    expect(pool.attacker).toContainDice('MECH', [6, 2])
  })
})
