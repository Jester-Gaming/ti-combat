import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('REFLECTIVE_SHIELDING + WAYLAY', () => {
  it('RS fires when ship sustains a Waylay AFB hit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: { WAYLAY: { isEnabled: true, uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 2 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
    })

    // Destroyer AFB [9, 2] × 2 = 4 dice
    // Waylay makes all ships valid targets
    // 1 AFB hit → Dreadnought sustains → RS produces 2 hits against attacker
    // Advance past AFB to SPACE_COMBAT:DICE_ROLL
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL', 1)

    expect(t.abilityLog('REFLECTIVE_SHIELDING')).not.toHaveLength(0)
    // Dreadnought sustained (damaged but alive)
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    // RS produced 2 hits against attacker's 2 destroyers
    expect(t.attacker.units.DESTROYER).toBeUndefined()
  })
})
