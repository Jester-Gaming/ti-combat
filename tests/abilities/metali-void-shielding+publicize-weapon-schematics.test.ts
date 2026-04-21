import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// Check the info for
// CAVALRY + PUBLICIZE_WEAPON_SCHEMATICS or METALI_VOID_SHIELDING + QUIETUS
// We don't have explicit ruling for that one
// For consistensy I t
describe.forEachSide(
  'METALI_VOID_SHIELDING + PUBLICIZE_WEAPON_SCHEMATICS',
  () => {
    it('Cannot target War Sun that lost sustain via PWS', () => {
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

      t.advanceTo('SPACE_COMBAT')
      t.advanceRound({ defender: 1 })

      // War Sun lost sustain via PWS, Void Shielding grants it back
      expect(t.abilityLog('METALI_VOID_SHIELDING')).toHaveLength(0)
      expect(t.defender.units.WAR_SUN).toBeFalsy()
    })
  },
)
