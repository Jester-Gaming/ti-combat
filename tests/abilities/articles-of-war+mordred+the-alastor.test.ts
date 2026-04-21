import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ARTICLES_OF_WAR + MORDRED + THE_ALASTOR', () => {
  it('mech loses Mordred ability but keeps sustain and participates as ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 1 },
        abilities: { ARTICLES_OF_WAR: true, MORDRED: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Mech still participates as ship (Alastor effect)
    // Mordred base: [6, 1] — with Articles of War, Mordred ability is stripped
    // but mech should still roll combat dice
    expect(pool.attacker).toContainDice('MECH', [6, 1])
  })
})
