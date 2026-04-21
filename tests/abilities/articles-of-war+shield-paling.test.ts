import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ARTICLES_OF_WAR + SHIELD_PALING', () => {
  it('Articles of War strips Shield Paling, Fragile re-applies to infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { MECH: 1, INFANTRY: 2 },
        abilities: { ARTICLES_OF_WAR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // If AoW strips Shield Paling:
    // Infantry should have Fragile penalty: [8, 1] + 1 = [9, 1]
    // Mech should have Fragile penalty: [6, 1] + 1 = [7, 1]
    expect(pool.attacker).toContainDice('INFANTRY', [9, 1])
    expect(pool.attacker).toContainDice('MECH', [7, 1])
  })
})
