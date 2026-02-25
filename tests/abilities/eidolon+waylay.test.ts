import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EIDOLON + WAYLAY', () => {
  it('Waylay AFB targets Z-Grav Eidolon as a ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: { WAYLAY: true },
      },
    })

    // Advance past AFB. Waylay expands targets to all ships.
    // Destroyers AFB 9x2 each = 4 dice total.
    // Z-Grav Eidolon (no sustain) and Cruiser are valid targets.
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL', { attacker: 2 })

    // With 2 hits from AFB targeting all ships,
    // both mech and cruiser could be destroyed
    const mechCount = t.attacker.units.MECH?.length ?? 0
    const cruiserCount = t.attacker.units.CRUISER?.length ?? 0
    expect(mechCount + cruiserCount).toBeLessThanOrEqual(1)
  })
})
