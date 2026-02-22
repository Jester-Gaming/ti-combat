import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ARTICLES_OF_WAR + MOLL_TERMINUS', () => {
  it('Moll Terminus sustain block is disabled', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { MECH: 1 },
        abilities: {
          ARTICLES_OF_WAR: true,
          SUSTAIN_DAMAGE: {
            groundPriority: ['MECH'],
          },
        },
      },
      defender: {
        faction: 'MENTAK_COALITION',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          SUSTAIN_DAMAGE: {
            groundPriority: ['MECH'],
          },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Attacker mech should sustain — Moll Terminus is disabled
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })
})
