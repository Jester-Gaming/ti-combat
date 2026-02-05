import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('CAVALRY + IMPULSE_CORE', () => {
  it('sacrifices Cavalry destroyer when DESTROYER:Cavalry is in priority', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 2 } },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 2, CRUISER: 1 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'DESTROYER' },
          IMPULSE_CORE: {
            isEnabled: true,
            sacrificePriority: ['DESTROYER:Cavalry'],
            targetPriority: ['CRUISER'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Cavalry destroyer sacrificed, plain destroyer survives
    expect(t.defender.units.DESTROYER).toHaveLength(1)
    expect(t.defender.units.DESTROYER![0].subtypes).toBeUndefined()
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('does not sacrifice Cavalry destroyer when only DESTROYER in priority', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 2 } },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 2, CRUISER: 1 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'DESTROYER' },
          IMPULSE_CORE: {
            isEnabled: true,
            sacrificePriority: ['DESTROYER'],
            targetPriority: ['CRUISER'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Plain destroyer sacrificed, Cavalry destroyer survives
    expect(t.defender.units.DESTROYER).toHaveLength(1)
    expect(t.defender.units.DESTROYER![0].subtypes).toContain('Cavalry')
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('targets opponent Cavalry cruiser when CRUISER:Cavalry in target priority', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 2 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 1, CRUISER: 1 },
        abilities: {
          IMPULSE_CORE: {
            isEnabled: true,
            sacrificePriority: ['DESTROYER'],
            targetPriority: ['CRUISER:Cavalry'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Impulse Core fired: destroyer sacrificed
    expect(t.defender.units.DESTROYER).toBeUndefined()
    expect(t.abilityLog('IMPULSE_CORE').length).toBeGreaterThan(0)
  })

  it('does not target opponent Cavalry cruiser when only CRUISER in target priority', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, FIGHTER: 2 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 1, CRUISER: 1 },
        abilities: {
          IMPULSE_CORE: {
            isEnabled: true,
            sacrificePriority: ['DESTROYER'],
            targetPriority: ['CRUISER'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // No plain cruiser to target — Impulse Core does not fire
    expect(t.defender.units.DESTROYER).toHaveLength(1)
    expect(t.abilityLog('IMPULSE_CORE')).toHaveLength(0)
  })
})
