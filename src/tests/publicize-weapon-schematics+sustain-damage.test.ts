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
            spacePriority: ['DREADNOUGHT', 'WAR_SUN'],
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

    t.advanceTo('SPACE_COMBAT', 'START')

    // 1 hit: Dreadnought sustains — verifies sustain not removed by PWS
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    // War Sun is undamaged — PWS removed its sustain, so it can't sustain
    expect(t.attacker.units.WAR_SUN![0].isDamaged).toBeFalsy()

    // 1 more hit: Dreadnought already damaged, War Sun can't sustain (PWS)
    // Hit assigned to Dreadnought (lower priority in assignment) — destroyed
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    // War Sun survives but remains undamaged (can't sustain due to PWS)
    expect(t.attacker.units.WAR_SUN).toHaveLength(1)
    expect(t.attacker.units.WAR_SUN![0].isDamaged).toBeFalsy()
  })
})
