import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DURANIUM_ARMOR + TECHNOLOGICAL_SINGULARITY', () => {
  it('repairs a pre-damaged Dread in R1 after Singularity enables Duranium Armor', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { DREADNOUGHT: 1, CRUISER: 2 },
        abilities: {
          PRE_DAMAGED: {
            isEnabled: true,
            damagedUnits: [['DREADNOUGHT', 1]],
          },
          TECHNOLOGICAL_SINGULARITY: {
            isEnabled: true,
            enableAbilityKey: 'DURANIUM_ARMOR',
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // R1: defender Cruiser destroyed → Singularity AFTER_DESTROY fires →
    // enables Duranium Armor → AFTER_ASSIGN_HITS_STEP fires → Dread repaired
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.CRUISER ?? []).toHaveLength(0)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)
    expect(t.abilityLog('DURANIUM_ARMOR')).not.toHaveLength(0)
  })
})
