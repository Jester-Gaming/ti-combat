import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('NON_EUCLIDEAN_SHIELDING', () => {
  it.forEachSide('cancels 2 hits when sustaining damage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 2 } },
      defender: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 1 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 2 })

    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
  })

  it.forEachSide('works with multiple sustain units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 4 } },
      defender: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 2 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 4 })

    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.DREADNOUGHT![1].isDamaged).toBe(true)

    expect(t.defender.units.DREADNOUGHT).toHaveLength(2)
  })

  it.forEachSide('works during space cannon offense', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 1 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
      defender: { faction: 'ARBOREC', units: { PDS: 2, CRUISER: 1 } },
    })

    // 2 PDS Space Cannon 6 = 2 dice, pick 2 hits against attacker
    t.advanceTo('AFB', { attacker: 2 })

    // Dreadnought sustains once, NES cancels extra hit (2 total)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
  })

  it('works during space cannon defense', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { MECH: 1 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
      defender: { faction: 'ARBOREC', units: { PDS: 2, INFANTRY: 1 } },
    })

    // 2 PDS Space Cannon 6 = 2 dice, pick 2 hits against attacker
    t.advanceTo('GROUND_COMBAT', { attacker: 2 })

    // Mech sustains once, NES cancels extra hit (2 total)
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it.forEachSide('works in ground combat with mechs', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
      defender: {
        faction: 'BARONY_OF_LETNEV',
        units: { MECH: 1 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 2 })

    // Mech sustains once, cancelling 2 hits
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)

    expect(t.defender.units.MECH).toHaveLength(1)
  })
})
