import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ARTICLES_OF_WAR + MOLL_TERMINUS', () => {
  it('Articles of War strips Moll Terminus ability — opponent can sustain', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { MECH: 1, INFANTRY: 2 },
        abilities: { ARTICLES_OF_WAR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { ARTICLES_OF_WAR: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // 1 hit to defender: with AoW, Moll Terminus is gone,
    // so defender mech should be able to sustain
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })
})
