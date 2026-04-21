import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('NON_EUCLIDEAN_SHIELDING + WAYLAY', () => {
  it('NES cancels 2 hits per sustain during Waylay AFB', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 3 },
        abilities: { WAYLAY: true },
      },
      defender: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
    })

    // 3 destroyers AFB 9x2 = 6 dice, Waylay targets all ships
    // Pick branch with 2 hits against defender
    // Dreadnought sustains once, NES cancels extra hit (2 total)
    t.advanceToTiming('ANNOUNCE_RETREAT_STEP', { defender: 2 })

    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })
})
