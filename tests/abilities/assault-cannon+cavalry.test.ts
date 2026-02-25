import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ASSAULT_CANNON + CAVALRY', () => {
  it.forEachSide(
    'Cavalry does not change non-fighter ship count for Assault Cannon',
    () => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { CRUISER: 3 },
          abilities: {
            ASSAULT_CANNON: true,
            CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
          },
        },
        defender: {
          faction: 'ARBOREC',
          units: { CRUISER: 3 },
        },
      })

      t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

      expect(t.abilityLog('ASSAULT_CANNON')).not.toHaveLength(0)
      expect(t.abilityLog('CAVALRY')).not.toHaveLength(0)
      expect(t.defender.units.CRUISER).toHaveLength(2)
    },
  )

  it('Assault Cannon target other type if no other valid targets', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: {
          ASSAULT_CANNON: {
            isEnabled: true,
            targetPriority: ['CRUISER:Cavalry', 'CRUISER'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, DESTROYER: 1 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('ASSAULT_CANNON')).not.toHaveLength(0)
    // Cruiser targeted and destroyed beforeCavalry
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.CRUISER![0].subtypes).includes('Cavalry')
    expect(t.defender.units.DESTROYER).toHaveLength(1)
  })

  it('Assault Cannon can target Cavalry subtype variant', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, DESTROYER: 1 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: {
          ASSAULT_CANNON: {
            isEnabled: true,
            targetPriority: ['CRUISER:Cavalry'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('ASSAULT_CANNON')).not.toHaveLength(0)
    // Cavalry Cruiser targeted and destroyed
    // Should have 1 plain Cruiser + 1 Destroyer left
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.CRUISER![0].subtypes).toBeUndefined()
    expect(t.attacker.units.DESTROYER).toHaveLength(1)
  })
})
