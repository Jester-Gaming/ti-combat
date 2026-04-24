import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TECHNOLOGICAL_SINGULARITY + TEMPORAL_COMMAND_SUITE', () => {
  it("Nekro's copy has a distinct key and boosts the chosen agent", () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CRUISER: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
          NEKRO_TEMPORAL_COMMAND_SUITE: {
            isEnabled: true,
            agentKey: 'VISCOUNT_UNLENN',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    // Nekro's copy applies +1 to Viscount uses (1 → 2)
    expect(t.state.attacker.abilities.VISCOUNT_UNLENN.uses).toBe(2)
  })

  it('normal TCS and Nekro copy can both be enabled independently', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { CRUISER: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
          TEMPORAL_COMMAND_SUITE: {
            isEnabled: true,
            agentKey: 'VISCOUNT_UNLENN',
          },
          NEKRO_TEMPORAL_COMMAND_SUITE: {
            isEnabled: true,
            agentKey: 'VISCOUNT_UNLENN',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    // Both copies fire at PREPARE: 1 → 2 → 3
    expect(t.state.attacker.abilities.VISCOUNT_UNLENN.uses).toBe(3)
  })
})
