import '../utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('LONCARA_SSODU', () => {
  it("Loncara Ssodu doesn't affect space cannon defense", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
      defender: {
        faction: 'XXCHA_KINGDOM',
        units: { FLAGSHIP: 1, PDS: 1, INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()!

    expect(pool.defender).toContainDice('PDS', [6, 1])
    expect(pool.defender.FLAGSHIP).toBeUndefined()
  })
})
