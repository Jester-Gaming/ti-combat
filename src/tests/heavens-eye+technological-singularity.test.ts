import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('HEAVENS_EYE + TECHNOLOGICAL_SINGULARITY', () => {
  it('flagship not repaired without kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          HEAVENS_EYE: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: flagship sustains 1 hit → damaged, no kill
    t.advanceRound({ attacker: 1 })
    // Round 2: HE not active → flagship still damaged → 1 more hit → destroyed
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
  })

  it('flagship repaired after kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          HEAVENS_EYE: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: flagship sustains + kill 1 cruiser → HE repairs at END
    t.advanceRound({ attacker: 1, defender: 1 })
    // Round 2: flagship can sustain again → survives 1 hit
    t.advanceRound({ attacker: 1 })

    // Flagship survived — HE repaired it at end of R1, allowing another sustain in R2
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    // HE also repairs at end of R2
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBeFalsy()
  })
})
