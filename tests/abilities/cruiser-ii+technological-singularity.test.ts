import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('CRUISER_II + TECHNOLOGICAL_SINGULARITY', () => {
  it('Singularity gains generic Cruiser II → next round dice show upgraded stats', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CRUISER: 3 },
        abilities: {
          TECHNOLOGICAL_SINGULARITY: {
            isEnabled: true,
            enableAbilityKey: 'NEKRO_GENERIC_UPGRADE_CRUISER',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')

    // Round 1: Cruisers still at base [7, 1] (Singularity fires after destroy
    // late in the round, so the round-1 dice roll itself is pre-upgrade)
    t.advanceRound({ defender: 1 })
    const round1Pool = t.dicePool()
    expect(round1Pool.attacker).toContainDice('CRUISER', [7, 1])
    expect(t.defender.units.CRUISER).toHaveLength(2)
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)

    // Round 2: Cruiser II → [6, 1]
    t.advanceRound()
    const round2Pool = t.dicePool()
    expect(round2Pool.attacker).toContainDice('CRUISER', [6, 1])
  })
})
