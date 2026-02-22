import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.skip('SARDAKK_FLAGSHIP + TECHNOLOGICAL_SINGULARITY', () => {
  it('no bonus to non-flagship dice in round 1', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: {
          SARDAKK_FLAGSHIP: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Cruiser base: [7, 1], no Sardakk bonus
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('-1 to non-flagship dice after kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: {
          SARDAKK_FLAGSHIP: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: kill 1 defender cruiser
    t.advanceRound({ defender: 1 })
    // Round 2: Sardakk flagship ability activates
    t.advanceRound()
    const pool = t.dicePool()!

    // Cruiser: 7 - 1(Sardakk) = 6
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
  })
})
