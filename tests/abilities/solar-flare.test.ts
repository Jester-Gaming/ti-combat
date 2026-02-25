import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('SOLAR_FLARE', () => {
  it('blocks opponent Space Cannon Offense', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { SOLAR_FLARE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
      },
    })

    // Past SCO
    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // PDS SCO should be blocked by Solar Flare
    expect(pool?.defender?.PDS).toBeUndefined()
  })
})
