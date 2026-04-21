import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EIDOLON + SALAI_SAI_CORIAN', () => {
  it('SSC counts Z-Grav Eidolon as non-fighter ship for dice', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Opponent non-fighter ships: CRUISER + Z-Grav MECH = 2
    // SSC rolls 2 dice
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 2])
  })
})
