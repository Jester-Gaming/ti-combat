import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.skip('DIRECT_HIT + IMPULSE_CORE + TECHNOLOGICAL_SINGULARITY', () => {
  it('impulse core does not fire — direct hit kill is after START_OF_COMBAT', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CRUISER: 3, DESTROYER: 1 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
          IMPULSE_CORE: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: DN sustains → DH kills it → TS triggers
    // But IC timing is START_OF_COMBAT (already passed)
    t.advanceRound({ defender: 1 })

    // Advance to round 2 — IC still can't fire (START_OF_COMBAT is one-time)
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // IC didn't fire — destroyer not sacrificed
    expect(t.attacker.units.DESTROYER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })
})
