import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('VISCOUNT_UNLENN', () => {
  it('adds 1 die to chosen ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'DREADNOUGHT' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    expect(t.abilityLog('VISCOUNT_UNLENN')).not.toHaveLength(0)

    const pool = t.dicePool()!
    // Dreadnought base: [5, 1] -> [5, 2]
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 2])
    // Cruiser unchanged: [7, 1]
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('subtype removed after dice roll, no extra die next round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'DREADNOUGHT' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    // Round 1: Viscount adds extra die
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool1 = t.dicePool()!
    expect(pool1.attacker).toContainDice('DREADNOUGHT', [5, 2])

    // Round 2: no extra die (subtype removed after dice roll)
    t.advanceRound()
    const pool2 = t.dicePool()!

    // Dreadnought back to base: [5, 1]
    expect(pool2.attacker).toContainDice('DREADNOUGHT', [5, 1])
  })

  it('does not fire when isEnabled is false', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: false, unitType: 'DREADNOUGHT' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Dreadnought unchanged: [5, 1]
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
  })
})
