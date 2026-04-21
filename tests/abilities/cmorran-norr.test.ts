import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('CMORRAN_NORR', () => {
  it('applies -1 hit value to non-flagship ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Flagship: [6, 2] - 1(Unrelenting) = [5, 2]
    // C'morran N'orr does NOT apply to the flagship itself
    expect(pool.attacker).toContainDice('FLAGSHIP', [5, 2])
    // Cruiser: 7 - 1(Unrelenting) - 1(C'morran N'orr) = 5
    expect(pool.attacker).toContainDice('CRUISER', [5, 1])
  })

  it('does not apply to ground forces', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { FLAGSHIP: 1, INFANTRY: 2 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Infantry: 8 - 1(Unrelenting) = 7, C'morran N'orr doesn't apply in ground combat
    expect(pool.attacker).toContainDice('INFANTRY', [7, 1], [7, 1])
  })
})
