import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('WAYLAY', () => {
  it('allows AFB hits to destroy non-fighter ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: { WAYLAY: true },
      },
    })

    // 2 destroyers AFB [9, 2] each. Waylay expands targets to all ships.
    // 1 hit should destroy a cruiser (normally AFB can only target fighters).
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL', { attacker: 1 })

    // Without Waylay, cruisers would be unaffected (no fighters to target)
    // With Waylay, 1 cruiser destroyed
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })
})
