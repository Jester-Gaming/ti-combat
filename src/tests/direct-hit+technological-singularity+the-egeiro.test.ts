import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('DIRECT_HIT + THE_EGEIRO + TECHNOLOGICAL_SINGULARITY', () => {
  it('-N to flagship dice after direct hit kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
          THE_EGEIRO: {
            isEnabled: false,
            nonHomeSystems: 2,
            enableBySingularity: true,
          },
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
    // Round 2: The Egeiro activates
    t.advanceRound()
    const pool = t.dicePool()!

    // Flagship: 9 - 2(Egeiro, nonHomeSystems) = 7
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 2])
  })
})
