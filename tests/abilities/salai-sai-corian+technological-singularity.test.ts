import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.skip('SALAI_SAI_CORIAN + TECHNOLOGICAL_SINGULARITY', () => {
  it('no dice count change in round 1', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          SALAI_SAI_CORIAN: {
            isEnabled: false,
            enableBySingularity: true,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1, FIGHTER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Flagship base: [9, 2], SSC not active
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 2])
  })

  it('sets dice count to opponent non-fighter ships after kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          SALAI_SAI_CORIAN: {
            isEnabled: false,
            enableBySingularity: true,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1, FIGHTER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: kill 1 fighter
    t.advanceRound({ defender: 1 })
    // Round 2: SSC activates → dice count = opponent non-fighter ships
    // Defender has: CRUISER: 1, FIGHTER: 1 → 1 non-fighter
    t.advanceRound()
    const pool = t.dicePool()!

    // Flagship dice count set to 1 (1 non-fighter ship)
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 1])
  })
})
