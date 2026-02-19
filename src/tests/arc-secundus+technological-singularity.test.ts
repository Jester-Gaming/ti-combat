import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe.skip('ARC_SECUNDUS + TECHNOLOGICAL_SINGULARITY', () => {
  it('flagship not repaired without kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          ARC_SECUNDUS: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: flagship sustains 1 hit → damaged, no kill
    t.advanceRound({ attacker: 1 })
    // Round 2: Arc Secundus not active → no repair → 1 more hit → destroyed
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
          ARC_SECUNDUS: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: flagship sustains + kill 1 cruiser
    t.advanceRound({ attacker: 1, defender: 1 })
    // Round 2: Arc Secundus activates at START_OF_COMBAT_ROUND → repairs flagship
    // Flagship can sustain again → survives 1 hit
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
  })
})
