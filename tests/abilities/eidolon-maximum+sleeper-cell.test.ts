import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EIDOLON_MAXIMUM + SLEEPER_CELL', () => {
  it('SC does not copy destroyed mech-ship (MECH is not a ship base type)', () => {
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
        abilities: { EIDOLON_MAXIMUM: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // 2 hits to defender: mech sustains 1 + 1 more destroys it
    t.advanceRound({ defender: 3 })

    // Mech destroyed — SC should NOT copy (MECH not in SHIPS)
    expect(t.defender.units.MECH).toBeUndefined()
    expect(t.attacker.units.MECH).toBeUndefined()
  })
})
