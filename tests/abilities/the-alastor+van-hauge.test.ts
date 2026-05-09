import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('THE_ALASTOR + VAN_HAUGE', () => {
  it("destroys Nekro's infantry participating as ships when flagship is destroyed", () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: 1 hit on flagship → sustains
    t.advanceRound({ attacker: 1 })
    // Alastor fires at START_OF_COMBAT and adds INFANTRY to Nekro's ships list
    expect(t.abilityLog('THE_ALASTOR')).not.toHaveLength(0)
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Round 2: 1 hit → flagship destroyed → Van Hauge triggers
    t.advanceRound({ attacker: 1 })

    // Van Hauge destroys all ships on both sides — for Nekro, INFANTRY
    // participate as ships via The Alastor and must be destroyed too.
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(t.defender.units.FLAGSHIP).toBeUndefined()
    expect(t.defender.units.INFANTRY).toBeUndefined()
  })
})
