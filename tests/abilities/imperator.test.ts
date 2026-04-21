import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('IMPERATOR', () => {
  it('applies +N modifier based on supportCount param', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { CRUISER: 1 },
        abilities: { IMPERATOR: { supportCount: 2 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser: 7 - 2(Imperator) = 5
    expect(pool.attacker).toContainDice('CRUISER', [5, 1])
  })

  it('applies no modifier when supportCount is 0', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { CRUISER: 1 },
        abilities: { IMPERATOR: { supportCount: 0 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser: 7 (no modifier)
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('applies to all unit types', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { CRUISER: 1, FIGHTER: 1 },
        abilities: { IMPERATOR: { supportCount: 1 } },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser: 7 - 1 = 6
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
    // Fighter: 9 - 1 = 8
    expect(pool.attacker).toContainDice('FIGHTER', [8, 1])
  })
})
