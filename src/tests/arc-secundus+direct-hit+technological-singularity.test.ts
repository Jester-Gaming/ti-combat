import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe.skip('ARC_SECUNDUS + DIRECT_HIT + TECHNOLOGICAL_SINGULARITY', () => {
  it('flagship repaired after direct hit kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
          ARC_SECUNDUS: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: flagship sustains + DN sustains → DH kills DN → TS triggers
    t.advanceRound({ attacker: 1, defender: 1 })
    // Round 2: Arc Secundus activates at START_OF_COMBAT_ROUND → repairs flagship
    // Flagship can sustain again → survives 1 hit
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
  })
})
