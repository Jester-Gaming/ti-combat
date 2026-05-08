import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('RAID_FORMATION + THE_ALASTOR', () => {
  it('damages Nekro mechs participating as ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 3 },
        abilities: {
          RAID_FORMATION: {
            // User adds MECH to priority when facing Nekro with Alastor
            targetPriority: [['MECH'], ['FLAGSHIP']],
          },
        },
      },
      defender: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 2 },
      },
    })

    // Alastor makes mechs participate as ships (has sustain)
    // 3 destroyers, no fighters, 3 excess hits
    t.advanceToTiming('BEFORE_ASSIGN_HITS', 3, 'AFB')

    // Both mechs and flagship have sustain, all 3 should be damaged
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
    expect(t.defender.units.MECH![1].isDamaged).toBe(true)
    expect(t.defender.units.FLAGSHIP![0].isDamaged).toBe(true)
  })
})
