import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ARTICLES_OF_WAR + EIDOLON', () => {
  it('Eidolon Z-Grav transform is stripped by Articles of War', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { ARTICLES_OF_WAR: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Eidolon stripped — mech is not a ship, no dice in space combat
    expect(pool.attacker.MECH).toBeUndefined()
  })

  it('mech retains sustain in ground combat under Articles of War', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          ARTICLES_OF_WAR: true,
          SUSTAIN_DAMAGE: {
            groundPriority: ['MECH'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1 })
    const pool = t.dicePool()

    // Normal Eidolon stats in ground combat
    expect(pool.attacker).toContainDice('MECH', [6, 2])
    // Sustain preserved by Articles of War
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
  })
})
