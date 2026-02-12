import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('FOURTH_MOON + TECHNOLOGICAL_SINGULARITY', () => {
  it('sustain blocked when FM always active', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          FOURTH_MOON: { isEnabled: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // FM PREPARE blocks sustain → dreadnought can't sustain → 1 hit kills it
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })

  it('opponent can sustain before kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          FOURTH_MOON: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // FM deferred → sustain works → dreadnought sustains 1 hit
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('restriction set after kill', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          FOURTH_MOON: { isEnabled: false, enableBySingularity: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, FIGHTER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Round 1: dreadnought sustains 1, 1 fighter killed → TS triggers
    t.advanceRound({ defender: 2 })

    // Advance to Round 2 DICE_ROLL — FM deferred PREPARE fires at START_OF_COMBAT_ROUND
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Verify sustain restriction is set on defender
    expect(
      t.defender.unitAbilityRestrictions?.cannotBeUsed?.SUSTAIN_DAMAGE,
    ).toEqual([{ reason: 'FOURTH_MOON' }])
  })
})
