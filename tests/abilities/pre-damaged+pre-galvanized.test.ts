import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('PRE_DAMAGED + PRE_GALVANIZED', () => {
  it('damages a Galvanized unit when target is base type', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['DREADNOUGHT', 1]],
          },
          PRE_DAMAGED: {
            isEnabled: true,
            damagedUnits: [['DREADNOUGHT:Galvanized', 1]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')

    const dreadnought = t.attacker.units.DREADNOUGHT!
    expect(dreadnought).toHaveLength(1)
    expect(dreadnought[0].subtypes).toContain('Galvanized')
    expect(dreadnought[0].isDamaged).toBe(true)
  })
})
