import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe.skip('SPEC_OPS + TECHNOLOGICAL_SINGULARITY', () => {
  it('applies Spec Ops stats when enabled', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { INFANTRY: 1 },
        abilities: {
          NEKRO_UNIT_FEDERATION_OF_SOL_INFANTRY: {
            isEnabled: true,
            disableBySingularity: true,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Spec Ops II: [6, 1]
    expect(pool.attacker).toContainDice('INFANTRY', [6, 1])
  })

  it('reverts to default infantry stats after kill', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { INFANTRY: 2 },
        abilities: {
          NEKRO_UNIT_FEDERATION_OF_SOL_INFANTRY: {
            isEnabled: true,
            disableBySingularity: true,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Round 1: kill 1 defender → triggers TS → reverts Spec Ops
    t.advanceRound({ defender: 1 })
    // Round 2: infantry back to default stats
    t.advanceRound()
    const pool = t.dicePool()!

    // Default infantry: [8, 1]
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1])
  })
})
