import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('FOURTH_MOON + METALI_VOID_SHIELDING', () => {
  it('blocks Void Shielding when sustain cannot be used', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { METALI_VOID_SHIELDING: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // Fourth Moon blocks sustain → Void Shielding can't fire → Cruiser destroyed
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('METALI_VOID_SHIELDING')).toHaveLength(0)
  })
})
