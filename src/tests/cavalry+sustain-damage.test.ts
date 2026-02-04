import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('CAVALRY + SUSTAIN_DAMAGE', () => {
  it('dynamically added sustain works on Cavalry unit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 2 } },
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

    // Advance past START (Cavalry fires) and AFB (no fighters to hit) to DICE_ROLL
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Cavalry fired at START_OF_COMBAT
    expect(t.abilityLog('CAVALRY')).toHaveLength(1)

    // Process combat dice: pick outcome where defender receives 1 hit
    t.advanceTo('SPACE_COMBAT', 'END', { defender: 1 })

    // Destroyer sustains the hit via dynamically added ability
    expect(t.defender.units.DESTROYER![0].isDamaged).toBe(true)
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

    // Advance past START (Cavalry fires) and AFB to DICE_ROLL
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Process combat dice: pick outcome where defender receives 1 hit
    t.advanceTo('SPACE_COMBAT', 'END', { defender: 1 })

    // DESTROYER in priority doesn't match DESTROYER:Cavalry — no sustain
    expect(t.defender.units.DESTROYER).toBeUndefined()
  })
})
