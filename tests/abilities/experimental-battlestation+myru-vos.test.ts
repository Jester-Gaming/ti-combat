import '../utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EXPERIMENTAL_BATTLESTATION + MYRU_VOS', () => {
  it('Myru Vos blocks PDS but Experimental Battlestation still fires', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: {
          MYRU_VOS: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
        abilities: {
          EXPERIMENTAL_BATTLESTATION: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    const pool = t.dicePool()!

    // PDS space cannon blocked by Myru Vos
    expect(pool.defender.PDS).toBeUndefined()
    // Experimental Battlestation is an action card, not a unit ability
    expect(pool.defender).toContainDice('EXPERIMENTAL_BATTLESTATION', [5, 3])
  })
})
