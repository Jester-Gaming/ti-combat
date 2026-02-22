import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('MYRU_VOS + SOLAR_FLARE', () => {
  it('both active, space cannon is still disabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          MYRU_VOS: true,
          SOLAR_FLARE: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 2, CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    const pool = t.dicePool()!

    expect(pool.defender.PDS).toBeUndefined()
  })
})
