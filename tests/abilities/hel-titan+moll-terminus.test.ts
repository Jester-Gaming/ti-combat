import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('HEL_TITAN + MOLL_TERMINUS', () => {
  it('Hel-Titan I sustain is blocked by Moll Terminus', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { MECH: 1, INFANTRY: 2 },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { PDS: 1, INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // 1 hit to defender: Hel-Titan can't sustain (Moll blocks ground forces)
    t.advanceRound({ defender: 1 })

    // Hel-Titan should not have sustained — infantry destroyed instead
    expect(t.defender.units.PDS![0].isDamaged).toBeFalsy()
    expect(t.defender.units.INFANTRY).toBeUndefined()
  })

  it('Hel-Titan I destroyed when sustain blocked and enough hits', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { MECH: 1, INFANTRY: 2 },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { PDS: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // 1 hit to defender: Hel-Titan can't sustain, gets destroyed
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.PDS).toBeUndefined()
  })
})
