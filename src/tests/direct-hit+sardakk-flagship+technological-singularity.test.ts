import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe.skip('DIRECT_HIT + SARDAKK_FLAGSHIP + TECHNOLOGICAL_SINGULARITY', () => {
  it('-1 to non-flagship dice after direct hit kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
          SARDAKK_FLAGSHIP: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: DN sustains → DH kills it → TS triggers
    t.advanceRound({ defender: 1 })
    // Round 2: Sardakk flagship ability activates
    t.advanceRound()
    const pool = t.dicePool()!

    // Cruiser: 7 - 1(Sardakk) = 6
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
  })
})
