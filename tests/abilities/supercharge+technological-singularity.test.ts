import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.skip('SUPERCHARGE + TECHNOLOGICAL_SINGULARITY', () => {
  it('no bonus in round 1 without kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CRUISER: 1 },
        abilities: {
          SUPERCHARGE: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Cruiser base: [7, 1], no supercharge
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('bonus activates in round 2 after kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CRUISER: 2 },
        abilities: {
          SUPERCHARGE: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: kill 1 defender cruiser
    t.advanceRound({ defender: 1 })
    // Round 2: supercharge activates
    t.advanceRound()
    const pool = t.dicePool()!

    // Cruiser: 7 - 1(supercharge) = 6
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
  })
})
