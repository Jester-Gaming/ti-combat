import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ARTICLES_OF_WAR', () => {
  it('mech Sustain Damage is preserved', () => {
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
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })
})
