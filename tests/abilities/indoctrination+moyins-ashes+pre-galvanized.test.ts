import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('INDOCTRINATION + MOYINS_ASHES + PRE_GALVANIZED', () => {
  it('does not deploy a mech when MECH cap is full of Galvanized mechs', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 1, MECH: 4 },
        abilities: {
          INDOCTRINATION: true,
          MOYINS_ASHES: true,
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['MECH', 4]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    // Indoctrination places 1 infantry. With the bug, MOYINS_ASHES reads
    // strict countUnits('MECH') = 0 < 4 → fires → removes the placed infantry,
    // placeUnits caps MECH placement to 0 → infantry lost for nothing.
    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.abilityLog('MOYINS_ASHES')).toHaveLength(0)
    expect(t.attacker.units.MECH).toHaveLength(4)
    // Indoctrinated infantry still on the board
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })
})
