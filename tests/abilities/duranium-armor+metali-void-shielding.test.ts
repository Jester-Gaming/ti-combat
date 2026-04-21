import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DURANIUM_ARMOR + METALI_VOID_SHIELDING', () => {
  it('does not repair a unit that used MVS sustain this round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          DURANIUM_ARMOR: true,
          METALI_VOID_SHIELDING: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: 1 hit — cruiser sustains via MVS
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('METALI_VOID_SHIELDING')).not.toHaveLength(0)
    // Cruiser that sustained via MVS is damaged
    expect(t.attacker.units.CRUISER).toHaveLength(2)
    expect(t.attacker.units.CRUISER!.some(u => u.isDamaged)).toBe(true)
    // Duranium should NOT repair it (used sustain this round)
    expect(t.attacker.units.CRUISER!.filter(u => u.isDamaged)).toHaveLength(1)
  })
})
