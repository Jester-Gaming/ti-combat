import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DURANIUM_ARMOR + PRE_DAMAGED', () => {
  it('does not repair during SCO phase', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: {
          PRE_DAMAGED: { isEnabled: true, damagedUnits: [['DREADNOUGHT', 1]] },
          DURANIUM_ARMOR: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, PDS: 1 },
      },
    })

    // SCO has ASSIGN_HITS (defender PDS fires), but Duranium should not trigger
    t.advanceTo('SPACE_COMBAT')
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.abilityLog('DURANIUM_ARMOR')).toHaveLength(0)
  })

  it('repairs a pre-damaged unit in round 1', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: {
          PRE_DAMAGED: { isEnabled: true, damagedUnits: [['DREADNOUGHT', 1]] },
          DURANIUM_ARMOR: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Round 1: 0 hits — Dreadnought was pre-damaged, didn't sustain → repaired
    t.advanceRound({ attacker: 0 })
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
    expect(t.abilityLog('DURANIUM_ARMOR')).not.toHaveLength(0)
  })
})
