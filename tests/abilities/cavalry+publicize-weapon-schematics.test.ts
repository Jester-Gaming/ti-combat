import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('CAVALRY + PUBLICIZE_WEAPON_SCHEMATICS', () => {
  it.skip('??? Cavalry on War Sun: PWS removes War Sun sustain but Cavalry overrides it', () => {
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
            spacePriority: ['WAR_SUN:Cavalry'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')
    expect(t.abilityLog('CAVALRY')).not.toHaveLength(0)

    // 1 hit on defender: Cavalry War Sun should sustain via subtype stats
    t.advanceTo('SPACE_COMBAT', 'END', { defender: 1 })

    expect(t.defender.units.WAR_SUN).toHaveLength(1)
    expect(t.defender.units.WAR_SUN![0].isDamaged).toBe(true)
  })
})
