import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TECHNOLOGICAL_SINGULARITY + HEL_TITAN + THE_ALASTOR', () => {
  it('Hel Titans participate in space combat as ships via Alastor', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, PDS: 2, CRUISER: 1 },
        abilities: {
          NEKRO_UNIT_TITANS_OF_UL_PDS: true,
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Hel Titan II (effective): COMBAT [6, 1] — participating as ships via Alastor
    expect(pool.attacker).toContainDice('PDS', [6, 1])
  })
})
