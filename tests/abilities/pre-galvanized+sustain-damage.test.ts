import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('PRE_GALVANIZED + SUSTAIN_DAMAGE', () => {
  it('uses subtype priority slot, not base slot', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { FLAGSHIP: 1, DREADNOUGHT: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: { FLAGSHIP: 1 },
          },
          SUSTAIN_DAMAGE: {
            spacePriority: ['FLAGSHIP:Galvanized', 'DREADNOUGHT', 'FLAGSHIP'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.FLAGSHIP![0].subtypes).toContain('Galvanized')
    expect(t.defender.units.FLAGSHIP![0].isDamaged).toBe(true)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
  })
})
