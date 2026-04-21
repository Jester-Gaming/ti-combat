import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('FOURTH_MOON + RAID_FORMATION', () => {
  it('does damage ships with blocked sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 3 },
        abilities: { RAID_FORMATION: true },
      },
      defender: {
        faction: 'MENTAK_COALITION',
        // FM blocks attacker sustain via cannotBeUsed
        units: { FLAGSHIP: 1, DREADNOUGHT: 1 },
      },
    })

    // 3 destroyers AFB [9,2] each = 6 dice, no fighters
    // 3 hits: all excess, but dreadnought sustain is blocked by FM
    t.advanceToTiming('BEFORE_ASSIGN_HITS', 3, 'AFB')

    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeTruthy()
    expect(t.defender.units.FLAGSHIP![0].isDamaged).toBeTruthy()
  })
})
