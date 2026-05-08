import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('PUBLICIZE_WEAPON_SCHEMATICS', () => {
  it('removes Sustain Damage from War Suns', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { WAR_SUN: 1 },
        abilities: {
          PUBLICIZE_WEAPON_SCHEMATICS: true,
          SUSTAIN_DAMAGE: {
            spacePriority: [['WAR_SUN', true]],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          PUBLICIZE_WEAPON_SCHEMATICS: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    // 1 hit to attacker: War Sun can't sustain (PWS removed it)
    t.advanceRound({ attacker: 1 })

    // War Sun destroyed (can't sustain)
    expect(t.attacker.units.WAR_SUN).toBeUndefined()
  })

  it('does not affect Dreadnought sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: {
          PUBLICIZE_WEAPON_SCHEMATICS: true,
          SUSTAIN_DAMAGE: {
            spacePriority: [['DREADNOUGHT', true]],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          PUBLICIZE_WEAPON_SCHEMATICS: true,
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    // Dreadnought sustains normally
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })
})
