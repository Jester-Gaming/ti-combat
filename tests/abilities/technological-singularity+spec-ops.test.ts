import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TECHNOLOGICAL_SINGULARITY + SPEC_OPS', () => {
  it('disabling Spec Ops II preserves Infantry II upgrade', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { INFANTRY: 2 },
        upgrades: ['INFANTRY'],
        abilities: {
          NEKRO_UNIT_FEDERATION_OF_SOL_INFANTRY: true,
          TECHNOLOGICAL_SINGULARITY: {
            isEnabled: true,
            disableAbilityKey: 'NEKRO_UNIT_FEDERATION_OF_SOL_INFANTRY',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT')

    // Round 1: Spec Ops II active → infantry at [6, 1]
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.INFANTRY).toHaveLength(2)
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)

    // Spec Ops II was active in round 1
    const round1Pool = t.dicePool()
    // Spec Ops II: [6, 1]
    expect(round1Pool.attacker).toContainDice('INFANTRY', [6, 1])

    // Round 2: Spec Ops II disabled → should revert to Infantry II [7, 1]
    t.advanceRound()
    const round2Pool = t.dicePool()

    // Infantry II: [7, 1] (not base Infantry I: [8, 1])
    expect(round2Pool.attacker).toContainDice('INFANTRY', [7, 1])
  })
})
