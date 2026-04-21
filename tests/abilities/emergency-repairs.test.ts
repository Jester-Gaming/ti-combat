import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EMERGENCY_REPAIRS', () => {
  it('repairs all sustain-damage units when all are damaged (fires at end-of-round)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2, CRUISER: 1 },
        abilities: { EMERGENCY_REPAIRS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: both dreadnoughts sustain — condition met at END_OF_COMBAT_ROUND → fires → repaired
    t.advanceRound({ attacker: 2 })
    expect(t.abilityLog('EMERGENCY_REPAIRS')).not.toHaveLength(0)
    expect(t.attacker.units.DREADNOUGHT!.every(u => !u.isDamaged)).toBe(true)
    // Cruiser is not a sustain unit — untouched either way
    expect(t.attacker.units.CRUISER![0].isDamaged).toBeFalsy()
  })

  it('does not fire when only some sustain-damage units are damaged', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
        abilities: { EMERGENCY_REPAIRS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Only one dreadnought sustains — condition (all sustain units damaged) not met
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.DREADNOUGHT!.filter(u => u.isDamaged)).toHaveLength(
      1,
    )
    expect(t.abilityLog('EMERGENCY_REPAIRS')).toHaveLength(0)
  })

  it('does not fire when there are no sustain-damage units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, FIGHTER: 2 },
        abilities: { EMERGENCY_REPAIRS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0 })

    expect(t.abilityLog('EMERGENCY_REPAIRS')).toHaveLength(0)
  })

  it('fires only once (uses decrement)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { EMERGENCY_REPAIRS: { isEnabled: true, uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: dreadnought sustains → condition met at end-of-round → repaired
    t.advanceRound({ attacker: 1 })
    expect(t.abilityLog('EMERGENCY_REPAIRS')).not.toHaveLength(0)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()

    // Round 2: dreadnought sustains again — Emergency Repairs is exhausted
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('works in ground combat (repairs mechs)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { MECH: 1, INFANTRY: 2 },
        abilities: { EMERGENCY_REPAIRS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // Round 1: mech sustains 1 hit → sole sustain unit damaged → ER fires at end-of-round → repaired
    t.advanceRound({ attacker: 1 })
    expect(t.abilityLog('EMERGENCY_REPAIRS')).not.toHaveLength(0)
    expect(t.attacker.units.MECH![0].isDamaged).toBeFalsy()
  })
})
