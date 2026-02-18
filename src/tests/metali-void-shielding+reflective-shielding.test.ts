import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('METALI_VOID_SHIELDING + REFLECTIVE_SHIELDING', () => {
  it('triggers sustain damage events for Reflective Shielding', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          METALI_VOID_SHIELDING: true,
          REFLECTIVE_SHIELDING: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Defender receives 1 dice hit, Void Shielding sustains →
    // triggers Reflective Shielding → attacker receives 2 extra hits
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.CRUISER![0].isDamaged).toBe(true)
    // 2 entries: direct sustain + nested Reflective Shielding trigger
    expect(t.abilityLog('METALI_VOID_SHIELDING')).toHaveLength(2)
    expect(t.abilityLog('REFLECTIVE_SHIELDING')).toHaveLength(1)
    // Attacker loses 2 Cruisers from Reflective Shielding's 2 hits
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })
})
