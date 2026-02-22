import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ALASTOR + SARDAKK_FLAGSHIP + VISZ_EL_VIR', () => {
  it('aura modifier applies to mech dice including added ones', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 2 },
        abilities: {
          SARDAKK_FLAGSHIP: { isEnabled: true, uses: Infinity },
          VISZ_EL_VIR: { isEnabled: true, uses: Infinity },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Flagship: [9, 2] (sardakk aura doesn't affect flagship)
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 2])
    // Each mech: base [6, 1]
    // Sardakk: -1 to non-flagship → [5, 1]
    // Visz El Vir: +1 die per mech → [5, 2]
    expect(pool.attacker).toContainDice('MECH', [5, 2])
  })
})
