import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EIDOLON + SLEEPER_CELL', () => {
  it('SC does not copy Z-Grav Eidolon (MECH not in ship base types)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: {
          SLEEPER_CELL: { isEnabled: true, fleetPool: 20 },
        },
      },
      defender: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Z-Grav mech has no sustain. 1 hit destroys it.
    t.advanceRound({ defender: 1 })

    // SC should NOT copy MECH (not a ship base type)
    expect(t.attacker.units.MECH).toBeUndefined()
  })
})
