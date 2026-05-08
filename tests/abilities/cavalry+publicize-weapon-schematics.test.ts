import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// I had a conversation with Milty about that scenario
// We don't have explicit rulling, but now for consistency
// (i.e. Metali Void Shielding + Crimson's Flagship)
// that iteraction is also disabled
describe.forEachSide('CAVALRY + PUBLICIZE_WEAPON_SCHEMATICS', () => {
  it("Cavalry on War Sun: Sustain Damage still can't be used", () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'ARBOREC',
        units: { WAR_SUN: 1 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'WAR_SUN' },
          PUBLICIZE_WEAPON_SCHEMATICS: true,
          SUSTAIN_DAMAGE: {
            spacePriority: [['WAR_SUN:Cavalry', true]],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()
    expect(t.abilityLog('CAVALRY')).not.toHaveLength(0)

    // 1 hit on defender: Cavalry War Sun should sustain via subtype stats
    t.advanceToTiming('END_OF_COMBAT_ROUND', { defender: 1 }, 'SPACE_COMBAT')

    expect(t.defender.units.WAR_SUN).toBeFalsy()
  })
})
