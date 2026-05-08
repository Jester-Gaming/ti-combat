import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('PRE_DAMAGED', () => {
  it('marks configured units as damaged at start', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 2 },
        abilities: {
          PRE_DAMAGED: { isEnabled: true, damagedUnits: [['DREADNOUGHT', 1]] },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')

    // Damaged peers sort to the tail (destroyed first), so the view shows
    // the healthy dreadnought at index 0 and the pre-damaged one at index 1.
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeUndefined()
    expect(t.attacker.units.DREADNOUGHT![1].isDamaged).toBe(true)
  })

  it('does not damage unconfigured unit types', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 1, WAR_SUN: 1 },
        abilities: {
          PRE_DAMAGED: { isEnabled: true, damagedUnits: [['DREADNOUGHT', 1]] },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')

    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.attacker.units.WAR_SUN![0].isDamaged).toBeUndefined()
  })

  it('clamps damage count to available units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 2 },
        abilities: {
          PRE_DAMAGED: { isEnabled: true, damagedUnits: [['DREADNOUGHT', 5]] },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')

    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.attacker.units.DREADNOUGHT![1].isDamaged).toBe(true)
  })
})
