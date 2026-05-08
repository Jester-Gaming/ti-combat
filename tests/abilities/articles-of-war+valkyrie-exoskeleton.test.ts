import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ARTICLES_OF_WAR + VALKYRIE_EXOSKELETON', () => {
  it('Valkyrie Exoskeleton retaliatory hit is disabled', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 1 },
        abilities: {
          ARTICLES_OF_WAR: true,
          SUSTAIN_DAMAGE: {
            groundPriority: [['MECH', true]],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1 })

    // Mech sustains
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)

    // Valkyrie Exoskeleton should NOT produce a retaliatory hit
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })
})
