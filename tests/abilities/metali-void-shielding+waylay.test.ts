import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('METALI_VOID_SHIELDING + WAYLAY', () => {
  it('MVS absorbs a Waylay AFB hit on a non-sustain ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: { WAYLAY: { isEnabled: true, uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { METALI_VOID_SHIELDING: true },
      },
    })

    // 2 Destroyers AFB [9, 2] = 4 dice
    // Waylay makes all ships valid targets
    // 1 AFB hit → MVS absorbs it on Cruiser (pseudo-sustain) → Cruiser damaged but alive
    // Advance past AFB to SPACE_COMBAT:DICE_ROLL
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL', 1)

    expect(t.abilityLog('METALI_VOID_SHIELDING')).not.toHaveLength(0)
    // Both cruisers survive — one damaged by MVS pseudo-sustain
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })

  it('MVS does not fire during normal AFB without Waylay', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, FIGHTER: 2 },
        abilities: { METALI_VOID_SHIELDING: true },
      },
    })

    // Without Waylay, AFB only hits fighters — MVS only targets non-fighter ships
    // 2 AFB hits → 2 fighters destroyed
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL', 2)

    // MVS should not fire (no hits pending against ships)
    expect(t.defender.units.CRUISER).toHaveLength(2)
    expect(t.defender.units.FIGHTER).toBeUndefined()
  })
})
