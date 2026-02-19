import './utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('FIGHTER_PROTOTYPE', () => {
  it('applies -2 hit value to FIGHTER combat dice', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 2, CARRIER: 1 },
        abilities: {
          FIGHTER_PROTOTYPE: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Fighter: 9 - 2(prototype) = 7
    expect(pool.defender).toContainDice('FIGHTER', [7, 1])
    // Carrier unchanged: 9
    expect(pool.defender).toContainDice('CARRIER', [9, 1])
  })
})
