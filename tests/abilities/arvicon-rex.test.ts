import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ARVICON_REX', () => {
  it('applies -2 hit value to flagship combat dice only', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MAHACT_GENE_SORCERERS',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: { ARVICON_REX: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Flagship: [5, 2] - 2(Arvicon Rex) = [3, 2]
    expect(pool.attacker).toContainDice('FLAGSHIP', [3, 2])
    // Cruiser unchanged: [7, 1]
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })
})
