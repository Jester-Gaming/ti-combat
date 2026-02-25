import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('PROPHECY_OF_IXTH', () => {
  it('applies -1 to fighter combat rolls in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { FIGHTER: 2, CRUISER: 1 },
        abilities: { PROPHECY_OF_IXTH: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Fighter: 9 - 1(Prophecy) = 8
    expect(pool.attacker).toContainDice('FIGHTER', [8, 1])
    // Cruiser unaffected: 7
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('does not affect non-fighter units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, DREADNOUGHT: 1 },
        abilities: { PROPHECY_OF_IXTH: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser: 7 (no modifier)
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
    // Dreadnought: 5 (no modifier)
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
  })
})
