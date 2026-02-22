import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('Custodia Vigilia + Plasma Scoring', () => {
  it('adds extra die to Custodia Vigilia dice pool during SCO', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'COUNCIL_KELERES',
        units: { CRUISER: 1 },
        abilities: {
          CUSTODIA_VIGILIA: true,
          PLASMA_SCORING: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()!

    // Custodia Vigilia [5, 1] + Plasma Scoring +1 = [5, 2]
    expect(pool.defender).toContainDice('CUSTODIA_VIGILIA', [5, 2])
  })
})
