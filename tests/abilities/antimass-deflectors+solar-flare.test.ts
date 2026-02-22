import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ANTIMASS_DEFLECTORS + SOLAR_FLARE', () => {
  it('Solar Flare disables space cannon entirely', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          SOLAR_FLARE: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
        abilities: {
          ANTIMASS_DEFLECTORS: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    const pool = t.dicePool()!

    // No PDS dice (Solar Flare disabled space cannon)
    expect(pool.defender.PDS).toBeUndefined()
  })
})
