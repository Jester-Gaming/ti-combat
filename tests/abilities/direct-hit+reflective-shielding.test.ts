import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DIRECT_HIT + REFLECTIVE_SHIELDING', () => {
  it('Reflective Shielding fires before Direct Hit (WHEN before AFTER)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Dreadnought sustains → RS fires (WHEN) → Direct Hit fires (AFTER)
    // Dreadnought is destroyed by Direct Hit
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()

    // 2 hits from Reflective Shielding still assigned — 2 cruisers destroyed
    expect(t.defender.units.CRUISER).toBeUndefined()
  })

  it('hits are produced even when Direct Hit destroys the sustaining ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Even though the dreadnought was destroyed by Direct Hit,
    // Reflective Shielding already produced 2 hits
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })
})
