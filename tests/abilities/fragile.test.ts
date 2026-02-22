import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('FRAGILE', () => {
  it('applies +1 to all combat dice', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Infantry: 8 + 1(Fragile) = 9
    expect(pool.attacker).toContainDice('INFANTRY', [9, 1])
  })
})
