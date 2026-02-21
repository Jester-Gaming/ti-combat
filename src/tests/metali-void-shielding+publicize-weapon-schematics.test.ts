import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('METALI_VOID_SHIELDING + PUBLICIZE_WEAPON_SCHEMATICS', () => {
  it('targets War Sun that lost sustain via PWS', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { WAR_SUN: 1 },
        abilities: {
          METALI_VOID_SHIELDING: true,
          PUBLICIZE_WEAPON_SCHEMATICS: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 1 })

    // War Sun lost sustain via PWS, Void Shielding grants it back
    expect(t.defender.units.WAR_SUN).toHaveLength(1)
    expect(t.defender.units.WAR_SUN![0].isDamaged).toBe(true)
    expect(t.abilityLog('METALI_VOID_SHIELDING')).not.toHaveLength(0)
  })
})
