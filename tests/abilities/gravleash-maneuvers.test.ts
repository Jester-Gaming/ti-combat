import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('GRAVLEASH_MANEUVERS', () => {
  it('applies +1 with a single ship type', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { CRUISER: 2 },
        abilities: {
          GRAVLEASH_MANEUVERS: {
            isEnabled: true,
            shipPriority: ['CRUISER'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // 1 ship type (Cruiser), base 7 - 1 = 6 for one Cruiser
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
    // Other Cruiser unchanged
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('applies +3 with three ship types', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 1, CRUISER: 1, DESTROYER: 1 },
        abilities: {
          GRAVLEASH_MANEUVERS: {
            isEnabled: true,
            shipPriority: ['CRUISER'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // 3 ship types, Cruiser base 7 - 3 = 4
    expect(pool.attacker).toContainDice('CRUISER', [4, 1])
    // Others unchanged
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
    expect(pool.attacker).toContainDice('DESTROYER', [9, 1])
  })

  it('recalculates bonus and target after ship type dies', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        // All non-sustain units to avoid sustain complicating hit assignment
        // Fighter is cheapest (sacrifice order: Fighter, Cruiser, Carrier)
        units: { CRUISER: 1, CARRIER: 1, FIGHTER: 1 },
        abilities: {
          GRAVLEASH_MANEUVERS: {
            isEnabled: true,
            shipPriority: ['FIGHTER', 'CRUISER', 'CARRIER'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')

    // R1: 3 types, +3 on Fighter (base 9 - 3 = 6), 1 hit kills Fighter (cheapest)
    t.advanceRound({ attacker: 1 })
    const pool1 = t.dicePool()
    expect(pool1.attacker).toContainDice('FIGHTER', [6, 1])
    expect(t.attacker.units.FIGHTER).toBeUndefined()

    // R2: 2 types left (Cruiser, Carrier), +2 falls to Cruiser (base 7 - 2 = 5)
    t.advanceRound()
    const pool2 = t.dicePool()
    expect(pool2.attacker).toContainDice('CRUISER', [5, 1])
    expect(pool2.attacker).toContainDice('CARRIER', [9, 1])
  })

  it('respects ship priority order', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: {
          GRAVLEASH_MANEUVERS: {
            isEnabled: true,
            shipPriority: ['DREADNOUGHT', 'CRUISER'],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // 2 ship types, applied to Dreadnought (first in priority)
    // Dreadnought base 5 - 2 = 3
    expect(pool.attacker).toContainDice('DREADNOUGHT', [3, 1])
    // Cruiser unchanged
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })
})
