import '../utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('MORALE_BOOST', () => {
  it('applies -1 hit value to all combat dice', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          MORALE_BOOST: { uses: 1 },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Cruiser: 7 - 1(morale) = 6
    expect(pool.defender).toContainDice('CRUISER', [6, 1])
  })

  it('does NOT affect AFB dice rolls', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { FIGHTER: 2, CARRIER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: {
          MORALE_BOOST: { uses: 1 },
        },
      },
    })

    // Morale boost fires at START_OF_COMBAT_ROUND (meta=SPACE_COMBAT)
    // AFB dice should NOT be affected (meta=AFB)
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')
    const pool = t.dicePool()!

    // Destroyer AFB: base value 9, dice 2 — NOT modified by morale boost
    expect(pool.defender).toContainDice('DESTROYER', [9, 2])
  })

  it('does not apply when uses are 0', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          MORALE_BOOST: { uses: 0 },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Cruiser: 7 (no modifier)
    expect(pool.defender).toContainDice('CRUISER', [7, 1])
  })
})
