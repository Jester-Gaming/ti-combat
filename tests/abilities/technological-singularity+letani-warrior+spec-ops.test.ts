import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TECHNOLOGICAL_SINGULARITY + LETANI_WARRIOR + SPEC_OPS', () => {
  it('disabling Letani II and enabling Spec Ops II gives correct dice', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { INFANTRY: 2 },
        abilities: {
          NEKRO_UNIT_ARBOREC_INFANTRY: true,
          TECHNOLOGICAL_SINGULARITY: {
            isEnabled: true,
            disableAbilityKey: 'NEKRO_UNIT_ARBOREC_INFANTRY',
            enableAbilityKey: 'NEKRO_UNIT_FEDERATION_OF_SOL_INFANTRY',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT')

    // Round 1: Letani II active → infantry at [7, 1]
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.INFANTRY).toHaveLength(2)
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)

    const round1Pool = t.dicePool()
    // Letani Warrior II: [7, 1]
    expect(round1Pool.attacker).toContainDice('INFANTRY', [7, 1])

    // Round 2: Letani disabled, Spec Ops II enabled → infantry at [6, 1]
    t.advanceRound()
    const round2Pool = t.dicePool()

    // Spec Ops II: [6, 1]
    expect(round2Pool.attacker).toContainDice('INFANTRY', [6, 1])
  })
})
