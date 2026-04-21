import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('NON_EUCLIDEAN_SHIELDING + RAID_FORMATION', () => {
  it('does not reduce Raid Formation damage count', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 3 },
        abilities: { RAID_FORMATION: true },
      },
      defender: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 2 },
        abilities: { NON_EUCLIDEAN_SHIELDING: true },
      },
    })

    // 3 destroyers AFB 9x2 = 6 dice, 0 fighters = all hits are excess
    // 2 hits: 2 excess, both dreadnoughts should be damaged
    t.advanceToTiming('BEFORE_ASSIGN_HITS', 2, 'AFB')

    // NES should not fire (Raid Formation doesn't trigger sustain)
    expect(t.abilityLog('NON_EUCLIDEAN_SHIELDING')).toHaveLength(0)
    // Both dreadnoughts should be damaged by Raid Formation
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.DREADNOUGHT![1].isDamaged).toBe(true)
  })
})
