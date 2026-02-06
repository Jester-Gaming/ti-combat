import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('ARTICLES_OF_WAR + MORDRED', () => {
  it('Mordred combat bonus is disabled', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { MECH: 1 },
        abilities: {
          ARTICLES_OF_WAR: true,
          MORDRED: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Without Mordred bonus, mech rolls at normal [6, 1]
    expect(pool.attacker).toContainDice('MECH', [6, 1])
  })
})
