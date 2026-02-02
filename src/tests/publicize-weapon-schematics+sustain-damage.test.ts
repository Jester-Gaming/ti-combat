import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('PUBLICIZE_WEAPON_SCHEMATICS + SUSTAIN_DAMAGE', () => {
  it('War Sun loses sustain but Dreadnought keeps it', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { WAR_SUN: 1, DREADNOUGHT: 1 },
        abilities: {
          SUSTAIN_DAMAGE: {
            hitPerSustain: 1,
            spaceUnits: ['DREADNOUGHT', 'WAR_SUN'],
            spaceUnitPriority: ['DREADNOUGHT', 'WAR_SUN'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          PUBLICIZE_WEAPON_SCHEMATICS: true,
        },
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('attacker', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Dreadnought sustained (ability not affected by PWS)
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    // War Sun did NOT sustain (PWS removed its sustain ability)
    expect(t.attacker.units.WAR_SUN![0].isDamaged).toBeFalsy()
  })
})
