import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('CAVALRY + SUSTAIN_DAMAGE', () => {
  it('dynamically added sustain works on Cavalry unit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'DESTROYER' },
          SUSTAIN_DAMAGE: {
            spaceUnits: ['DESTROYER:Cavalry'],
            spaceUnitPriority: ['DESTROYER:Cavalry'],
          },
        },
      },
    })

    // Cavalry fires at START_OF_COMBAT, granting SUSTAIN_DAMAGE to the Destroyer
    t.runTiming(['START_OF_COMBAT', 'START_OF_COMBAT_ROUND'])

    expect(t.defender.units.DESTROYER![0].subtypes).toContain('Cavalry')
    expect(t.defender.units.DESTROYER![0].UNIT_ABILITIES?.SUSTAIN_DAMAGE).toBe(
      true,
    )

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Destroyer sustains the hit via dynamically added ability
    expect(t.defender.units.DESTROYER![0].isDamaged).toBe(true)

    t.assignHits()
    expect(t.defender.units.DESTROYER).toHaveLength(1)
  })

  it('Cavalry unit does not sustain when only plain DESTROYER is in priority', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'DESTROYER' },
          SUSTAIN_DAMAGE: {
            spaceUnits: ['DESTROYER'],
            spaceUnitPriority: ['DESTROYER', 'DESTROYER:Cavalry'],
          },
        },
      },
    })

    t.runTiming(['START_OF_COMBAT', 'START_OF_COMBAT_ROUND'])

    expect(t.defender.units.DESTROYER![0].subtypes).toContain('Cavalry')

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 1)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // DESTROYER in priority doesn't match DESTROYER:Cavalry — no sustain
    expect(t.defender.units.DESTROYER![0].isDamaged).toBeFalsy()
  })
})
