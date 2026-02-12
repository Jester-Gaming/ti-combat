import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('DIRECT_HIT + SALAI_SAI_CORIAN + TECHNOLOGICAL_SINGULARITY', () => {
  it('sets dice count to opponent non-fighter ships after direct hit kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
          SALAI_SAI_CORIAN: {
            isEnabled: false,
            enableBySingularity: true,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1, FIGHTER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: DN sustains → DH kills it → TS triggers
    t.advanceRound({ defender: 1 })
    // Round 2: SSC activates → dice count = opponent non-fighter ships
    // Defender has: CRUISER: 1, FIGHTER: 2 → 1 non-fighter
    t.advanceRound()
    const pool = t.dicePool()!

    // Flagship dice count set to 1 (1 non-fighter ship)
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 1])
  })
})
