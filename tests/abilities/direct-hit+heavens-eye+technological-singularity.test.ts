import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.skip('DIRECT_HIT + HEAVENS_EYE + TECHNOLOGICAL_SINGULARITY', () => {
  it('flagship repaired after direct hit kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
          HEAVENS_EYE: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: flagship sustains + DN sustains → DH kills DN → TS → HE repairs at END
    t.advanceRound({ attacker: 1, defender: 1 })
    // Round 2: flagship can sustain again → survives 1 hit
    t.advanceRound({ attacker: 1 })

    // Flagship survived — HE repaired it at end of R1, allowing another sustain in R2
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    // HE also repairs at end of R2
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBeFalsy()
  })
})
