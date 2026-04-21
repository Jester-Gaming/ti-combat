import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('REFLECTIVE_SHIELDING', () => {
  it('produces 2 hits when own ship sustains', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    // Dreadnought sustains, Reflective Shielding produces 2 hits against opponent
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // 2 hits destroy 2 cruisers
    expect(t.defender.units.CRUISER).toBeUndefined()
  })

  it('does not fire during Space Cannon Offense', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', { attacker: 1 })

    // Dreadnought sustained from SCO hit
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    // RS should not fire during SCO
    expect(t.abilityLog('REFLECTIVE_SHIELDING')).toHaveLength(0)
  })

  it('does not fire during ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { MECH: 1 },
        abilities: { REFLECTIVE_SHIELDING: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1 })

    // Mech sustains
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)

    // No hits produced — infantry survive (RS context is SPACE)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })
})
