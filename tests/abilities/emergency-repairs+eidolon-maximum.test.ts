import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EMERGENCY_REPAIRS + EIDOLON_MAXIMUM', () => {
  it('repairs an Eidolon Maximum mech in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1 },
        abilities: {
          EIDOLON_MAXIMUM: true,
          EMERGENCY_REPAIRS: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: mech sustains 1 hit → damaged at end-of-round → ER fires (sole sustain unit) → repaired
    t.advanceRound({ attacker: 1 })
    expect(t.abilityLog('EMERGENCY_REPAIRS')).not.toHaveLength(0)
    expect(t.attacker.units.MECH![0].isDamaged).toBeFalsy()
  })
})
