import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('NEBULA', () => {
  it('applies -1 to defender combat rolls in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { NEBULA: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Defender Cruiser: 7 - 1(Nebula) = 6
    expect(pool.defender).toContainDice('CRUISER', [6, 1])
    // Attacker Cruiser: 7 (no modifier)
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('applies to all defender unit types', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, DREADNOUGHT: 1 },
        abilities: { NEBULA: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Defender Cruiser: 7 - 1 = 6
    expect(pool.defender).toContainDice('CRUISER', [6, 1])
    // Defender Dreadnought: 5 - 1 = 4
    expect(pool.defender).toContainDice('DREADNOUGHT', [4, 1])
  })
})
