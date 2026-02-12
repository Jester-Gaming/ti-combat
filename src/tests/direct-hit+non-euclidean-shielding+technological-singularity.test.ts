import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('DIRECT_HIT + NON_EUCLIDEAN_SHIELDING + TECHNOLOGICAL_SINGULARITY', () => {
  it('sustain cancels 2 hits after direct hit kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { DREADNOUGHT: 1 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
          NON_EUCLIDEAN_SHIELDING: {
            isEnabled: false,
            enableBySingularity: true,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: defender DN sustains → DH kills it → TS triggers
    t.advanceRound({ defender: 1 })
    // Round 2: NES activates → sustain cancels 2 hits
    t.advanceRound({ attacker: 2 })

    // Dreadnought survives — NES sustain cancelled both hits
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })
})
