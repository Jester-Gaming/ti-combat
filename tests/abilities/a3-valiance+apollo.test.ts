import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('A3_VALIANCE + APOLLO', () => {
  it('Hero stamped when A3 Valiance galvanizes infantry mid-combat', () => {
    // Ground combat. Attacker has 1 galvanized mech (Last Bastion) and 3
    // infantry. When the galvanized mech dies, A3 Valiance galvanizes up to
    // 3 infantry; the first galvanize emits WHEN_GALVANIZE → Apollo stamps
    // Hero on that first infantry.
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { MECH: 1, INFANTRY: 3 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['MECH', 1]],
            reinforcementTokens: 7,
          },
          APOLLO: { isEnabled: true, heroUnit: 'INFANTRY:Galvanized' },
          UNIT_PRIORITY: {
            groundUnitPriority: [['MECH:Galvanized'], ['INFANTRY']],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 4 } },
    })

    t.advanceTo('GROUND_COMBAT')
    // Attacker takes enough hits to kill the galvanized MECH (2 hits — sustain
    // then destroy).
    t.advanceRound({ attacker: 2 })

    // Verify MECH died
    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.abilityLog('A3_VALIANCE')).not.toHaveLength(0)

    // A3 Valiance galvanized infantry; Apollo stamped Hero on the first
    // galvanized infantry.
    const infantry = t.attacker.units.INFANTRY ?? []
    const heroInfantry = infantry.filter(u => u.subtypes?.includes('Hero'))
    expect(heroInfantry).toHaveLength(1)
    expect(heroInfantry[0].subtypes).toContain('Galvanized')
  })
})
