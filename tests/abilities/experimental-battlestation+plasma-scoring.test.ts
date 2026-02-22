import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('Experimental Battlestation + Plasma Scoring', () => {
  it('adds extra die to battlestation dice pool', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          EXPERIMENTAL_BATTLESTATION: true,
          PLASMA_SCORING: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()!

    // Battlestation [5, 3] + Plasma Scoring +1 = [5, 4]
    expect(pool.defender).toContainDice('EXPERIMENTAL_BATTLESTATION', [5, 4])
  })
})
