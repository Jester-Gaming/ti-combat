import '../utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ANTIMASS_DEFLECTORS + MYRU_VOS', () => {
  it('Myru Vos disables space cannon, Antimass Deflectors has no effect', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          MYRU_VOS: true,
          ANTIMASS_DEFLECTORS: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    const pool = t.dicePool()!

    // PDS dice completely disabled by Myru Vos
    expect(pool.defender.PDS).toBeUndefined()
  })
})
