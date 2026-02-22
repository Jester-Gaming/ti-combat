import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.skip('DIRECT_HIT + FOURTH_MOON + TECHNOLOGICAL_SINGULARITY', () => {
  it('restriction set after direct hit kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
          FOURTH_MOON: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: DN sustains → DH kills it → TS triggers
    t.advanceRound({ defender: 1 })

    // Advance to Round 2 DICE_ROLL — FM deferred PREPARE fires at START_OF_COMBAT_ROUND
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Verify sustain restriction is set on defender
    expect(
      t.defender.unitAbilityRestrictions?.cannotBeUsed?.SUSTAIN_DAMAGE,
    ).toEqual([{ reason: 'FOURTH_MOON' }])
  })

  it('second dreadnought cannot sustain after first is direct-hit killed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          DIRECT_HIT: { uses: 1 },
          FOURTH_MOON: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 2 hits: DN1 sustains → DH kills it → TS → FM blocks sustain
    // DN2 can't sustain → destroyed by 2nd hit
    t.advanceRound({ defender: 2 })

    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })
})
