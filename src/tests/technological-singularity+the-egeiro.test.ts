import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('THE_EGEIRO + TECHNOLOGICAL_SINGULARITY', () => {
  it('no bonus to flagship dice in round 1', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          THE_EGEIRO: {
            isEnabled: false,
            nonHomeSystems: 2,
            enableBySingularity: true,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Flagship base: [9, 2], no Egeiro bonus
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 2])
  })

  it('-N to flagship dice after kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          THE_EGEIRO: {
            isEnabled: false,
            nonHomeSystems: 2,
            enableBySingularity: true,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: kill 1 defender cruiser
    t.advanceRound({ defender: 1 })
    // Round 2: The Egeiro activates
    t.advanceRound()
    const pool = t.dicePool()!

    // Flagship: 9 - 2(Egeiro, nonHomeSystems) = 7
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 2])
  })
})
