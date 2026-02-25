import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('RAID_FORMATION + WAYLAY', () => {
  it('damages ships AND hits still get assigned to all ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 3 },
        abilities: { RAID_FORMATION: true, WAYLAY: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 1, DREADNOUGHT: 2 },
      },
    })

    // 3 destroyers AFB 9x2 = 6 dice, 1 fighter
    // 3 hits: 3 - 1 fighter = 2 excess -> both dreadnoughts damaged by Raid Formation
    t.advanceTo('AFB', 'ASSIGN_HITS', 3)

    // Raid Formation should fire
    expect(t.abilityLog('RAID_FORMATION')).not.toHaveLength(0)

    // Both dreadnoughts damaged by Raid Formation (before hit assignment)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.DREADNOUGHT![1].isDamaged).toBe(true)
  })

  it('excess hits damage ships even when no fighters present', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 3 },
        abilities: { RAID_FORMATION: true, WAYLAY: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2, CRUISER: 2 },
      },
    })

    // 3 destroyers AFB 9x2 = 6 dice, 0 fighters = all hits are excess
    // 2 hits: 2 excess, both dreadnoughts damaged by Raid Formation
    // Then those 2 hits must be assigned to ships (Waylay makes all ships valid)
    t.advanceTo('AFB', 'ASSIGN_HITS', 2)

    expect(t.abilityLog('RAID_FORMATION')).not.toHaveLength(0)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.DREADNOUGHT![1].isDamaged).toBe(true)
  })
})
