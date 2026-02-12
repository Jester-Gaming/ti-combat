import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('LETANI + TECHNOLOGICAL_SINGULARITY', () => {
  it('applies upgraded stats when enabled', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { INFANTRY: 1 },
        abilities: {
          NEKRO_UNIT_ARBOREC_INFANTRY: {
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

    // Letani Warrior II: [7, 1]
    expect(pool.attacker).toContainDice('INFANTRY', [7, 1])
  })

  it('reverts stats after kill', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { INFANTRY: 2 },
        abilities: {
          NEKRO_UNIT_ARBOREC_INFANTRY: {
            isEnabled: true,
            disableBySingularity: true,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Round 1: kill 1 defender → triggers TS → reverts Letani upgrade
    t.advanceRound({ defender: 1 })
    // Round 2: infantry back to default stats
    t.advanceRound()
    const pool = t.dicePool()!

    // Reverted to Letani Warrior I base: [8, 1] (= default infantry)
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1])
  })
})
