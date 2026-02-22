import '../utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('FRAGILE + NEBULA', () => {
  it('cancel each other out for net zero modifier', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
      defender: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { CRUISER: 1 },
        abilities: {
          NEBULA: true,
          FRAGILE: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Cruiser: 7 + 1(fragile) - 1(nebula) = 7
    expect(pool.defender).toContainDice('CRUISER', [7, 1])
  })
})
