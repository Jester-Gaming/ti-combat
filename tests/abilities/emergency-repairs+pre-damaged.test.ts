import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EMERGENCY_REPAIRS + PRE_DAMAGED', () => {
  it('fires at round 1 START_OF_COMBAT_ROUND when all sustain units are pre-damaged', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2, CRUISER: 1 },
        abilities: {
          PRE_DAMAGED: { isEnabled: true, damagedUnits: [['DREADNOUGHT', 2]] },
          EMERGENCY_REPAIRS: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Both dreads pre-damaged, cruiser not (cruiser has no SUSTAIN_DAMAGE anyway)
    expect(t.attacker.units.DREADNOUGHT!.every(u => u.isDamaged)).toBe(true)

    // Round 1 START_OF_COMBAT_ROUND: all sustain units are damaged → ER fires → repairs
    t.advanceRound({ attacker: 0 })
    expect(t.abilityLog('EMERGENCY_REPAIRS')).not.toHaveLength(0)
    expect(t.attacker.units.DREADNOUGHT!.every(u => !u.isDamaged)).toBe(true)
  })

  it('does not fire when only some pre-damaged and others undamaged', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
        abilities: {
          PRE_DAMAGED: { isEnabled: true, damagedUnits: [['DREADNOUGHT', 1]] },
          EMERGENCY_REPAIRS: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // 1 dread damaged, 1 undamaged
    expect(t.attacker.units.DREADNOUGHT!.filter(u => u.isDamaged)).toHaveLength(
      1,
    )

    t.advanceRound({ attacker: 0 })
    // Condition "all sustain units damaged" not met → ER doesn't fire
    expect(t.abilityLog('EMERGENCY_REPAIRS')).toHaveLength(0)
    expect(t.attacker.units.DREADNOUGHT!.filter(u => u.isDamaged)).toHaveLength(
      1,
    )
  })
})
