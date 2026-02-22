import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.skip('ARVICON_REX + TECHNOLOGICAL_SINGULARITY', () => {
  it('no bonus to flagship dice in round 1', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          ARVICON_REX: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Flagship base: [9, 2], no Arvicon Rex bonus
    expect(pool.attacker).toContainDice('FLAGSHIP', [9, 2])
  })

  it('-2 to flagship dice after kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          ARVICON_REX: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: kill 1 defender cruiser
    t.advanceRound({ defender: 1 })
    // Round 2: Arvicon Rex activates
    t.advanceRound()
    const pool = t.dicePool()!

    // Flagship: 9 - 2(Arvicon Rex) = 7
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 2])
  })
})
