import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('Salai Sai Corian + The Alastor', () => {
  it('counts ground forces participating as ships via The Alastor', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 2, MECH: 1 },
      },
    })

    // The Alastor adds ground forces as participating ships
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // 1 flagship + 2 infantry + 1 mech = 4 non-fighter ships
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 4])
  })
})
