import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('METALI_VOID_SHIELDING + NON_EUCLIDEAN_SHIELDING', () => {
  it('NES cancels 2 hits when MVS grants sustain to a cruiser', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'BARONY_OF_LETNEV',
        units: { CRUISER: 1 },
        abilities: {
          NON_EUCLIDEAN_SHIELDING: true,
          METALI_VOID_SHIELDING: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // 2 hits on defender: MVS-granted sustain on cruiser + NES cancels 2nd hit
    t.advanceRound({ defender: 2 })

    expect(t.abilityLog('METALI_VOID_SHIELDING')).not.toHaveLength(0)
    expect(t.abilityLog('NON_EUCLIDEAN_SHIELDING')).not.toHaveLength(0)
    // Cruiser survived — MVS sustain + NES cancelled both hits
    expect(t.defender.units.CRUISER![0].isDamaged).toBe(true)
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })
})
