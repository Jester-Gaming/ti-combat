import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('SLEEPER_CELL + THE_ALASTOR', () => {
  it('does not copy destroyed infantry participating as ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: { SLEEPER_CELL: { isEnabled: true, fleetPool: 8 } },
      },
      defender: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 2 hits destroy both infantry
    t.advanceRound({ defender: 2 })

    // Sleeper Cell should NOT place infantry for attacker (not a ship type)
    expect(t.attacker.units.INFANTRY).toBeUndefined()
  })

  it('does not copy destroyed mech participating as ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: { SLEEPER_CELL: { isEnabled: true, fleetPool: 8 } },
      },
      defender: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 2 hits destroy both mechs
    t.advanceRound({ defender: 2 })

    // Sleeper Cell should NOT place mech for attacker (not a ship type)
    expect(t.attacker.units.MECH).toBeUndefined()
  })
})
