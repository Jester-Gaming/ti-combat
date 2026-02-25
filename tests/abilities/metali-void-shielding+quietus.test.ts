import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('METALI_VOID_SHIELDING + QUIETUS', () => {
  it.skip('??? MVS cannot fire when Quietus blocks sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { METALI_VOID_SHIELDING: true, QUIETUS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { QUIETUS: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 1 hit to attacker — cruiser can't use MVS sustain (Quietus blocks)
    t.advanceRound({ attacker: 1 })

    // Cruiser destroyed (MVS couldn't fire)
    expect(t.abilityLog('METALI_VOID_SHIELDING')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER![0].isDamaged).toBe(true)
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })
})
