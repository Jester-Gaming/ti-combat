import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('PRE_GALVANIZED + RAID_FORMATION', () => {
  it('counts a Galvanized fighter as a fighter for AFB excess', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 1 },
        abilities: { RAID_FORMATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 1, DREADNOUGHT: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['FIGHTER', 1]],
          },
        },
      },
    })

    t.advanceToTiming('BEFORE_ASSIGN_HITS', 1, 'AFB')

    // 1 AFB hit, and the (Galvanized) fighter is the right target — no excess.
    // Bug: strict countUnits('FIGHTER') = 0 → excess = 1 → DREADNOUGHT damaged.
    expect(t.abilityLog('RAID_FORMATION')).toHaveLength(0)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
  })
})
