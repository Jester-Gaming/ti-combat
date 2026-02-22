import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.skip('LETANI + SPEC_OPS + TECHNOLOGICAL_SINGULARITY', () => {
  it('uses first upgrade before kill', () => {
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
          NEKRO_UNIT_FEDERATION_OF_SOL_INFANTRY: {
            isEnabled: false,
            enableBySingularity: true,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Letani Warrior II: [7, 1]
    expect(pool.attacker).toContainDice('INFANTRY', [7, 1])
  })

  it('switches to second upgrade after kill', () => {
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
          NEKRO_UNIT_FEDERATION_OF_SOL_INFANTRY: {
            isEnabled: false,
            enableBySingularity: true,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Round 1: Letani active [7, 1], kill 1 defender → TS fires
    t.advanceRound({ defender: 1 })
    // Round 2: Spec Ops II should be active now
    t.advanceRound()
    const pool = t.dicePool()!

    // Spec Ops II: [6, 1]
    expect(pool.attacker).toContainDice('INFANTRY', [6, 1])
  })

  it('switches from Spec Ops to Letani after kill', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { INFANTRY: 2 },
        abilities: {
          NEKRO_UNIT_ARBOREC_INFANTRY: {
            isEnabled: false,
            enableBySingularity: true,
          },
          NEKRO_UNIT_FEDERATION_OF_SOL_INFANTRY: {
            isEnabled: true,
            disableBySingularity: true,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    // Round 1: Spec Ops active [6, 1], kill 1 defender → TS fires
    t.advanceRound({ defender: 1 })
    // Round 2: Letani Warrior II should be active now
    t.advanceRound()
    const pool = t.dicePool()!

    // Letani Warrior II: [7, 1]
    expect(pool.attacker).toContainDice('INFANTRY', [7, 1])
  })
})
