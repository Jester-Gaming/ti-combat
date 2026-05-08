import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EMERGENCY_REPAIRS + FOURTH_MOON', () => {
  it('repairs sustain-in-stats units even when SUSTAIN_DAMAGE is blocked by Fourth Moon', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2, CRUISER: 1 },
        abilities: {
          PRE_DAMAGED: { isEnabled: true, damagedUnits: [['DREADNOUGHT', 2]] },
          EMERGENCY_REPAIRS: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Defender's dreadnoughts start damaged. Fourth Moon blocks their sustain,
    // but Emergency Repairs checks stats only.
    expect(t.defender.units.DREADNOUGHT!.every(u => u.isDamaged)).toBe(true)

    // Round 1 START_OF_COMBAT_ROUND: all defender sustain-in-stats units damaged → ER fires
    t.advanceRound({ defender: 0 })
    expect(t.abilityLog('EMERGENCY_REPAIRS')).not.toHaveLength(0)
    expect(t.defender.units.DREADNOUGHT!.some(u => u.isDamaged)).toBe(false)
  })
})
