import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EIDOLON_MAXIMUM + FOURTH_MOON', () => {
  it('blocks Eidolon Maximum mech sustain in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { DREADNOUGHT: 1, MECH: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 1 hit to defender: mech can't sustain (FM blocks ships, Eidolon Maximum adds mech to ships)
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.MECH).toBeUndefined()
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
  })
})
