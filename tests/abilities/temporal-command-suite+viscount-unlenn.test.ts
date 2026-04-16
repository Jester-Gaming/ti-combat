import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TEMPORAL_COMMAND_SUITE + VISCOUNT_UNLENN', () => {
  it('adds +1 use to own agent at PREPARE', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NOMAD',
        units: { CRUISER: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
          TEMPORAL_COMMAND_SUITE: {
            isEnabled: true,
            agentKey: 'VISCOUNT_UNLENN',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    // Viscount default uses: 1 → +1 from Temporal Command Suite = 2
    expect(t.state.abilities.attacker.VISCOUNT_UNLENN.uses).toBe(2)
  })

  it('does nothing when no agent is selected', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NOMAD',
        units: { CRUISER: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
          TEMPORAL_COMMAND_SUITE: { isEnabled: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    // Viscount uses stays at default (1)
    expect(t.state.abilities.attacker.VISCOUNT_UNLENN.uses).toBe(1)
  })

  it('works for non-Nomad factions (external tech)', () => {
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
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    expect(t.state.abilities.attacker.VISCOUNT_UNLENN.uses).toBe(2)
  })
})
