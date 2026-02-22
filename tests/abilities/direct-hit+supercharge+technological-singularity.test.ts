import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.skip('DIRECT_HIT + SUPERCHARGE + TECHNOLOGICAL_SINGULARITY', () => {
  it('supercharge activates in round 2 after direct hit kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CRUISER: 3 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
          SUPERCHARGE: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: DN sustains → DH kills it → TS triggers
    t.advanceRound({ defender: 1 })
    // Round 2: Supercharge activates
    t.advanceRound()
    const pool = t.dicePool()!

    // Cruiser: 7 - 1(supercharge) = 6
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
  })
})
