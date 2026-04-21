import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DURANIUM_ARMOR + RAID_FORMATION', () => {
  it('allows Duranium Armor to repair in the first round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 3 },
        abilities: { RAID_FORMATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 1, DREADNOUGHT: 1 },
        abilities: { DURANIUM_ARMOR: true },
      },
    })

    // 3 destroyers AFB 9x2 = 6 dice, 1 fighter
    // 2 hits: 2 - 1 fighter = 1 excess, damages dreadnought
    t.advanceToTiming('BEFORE_ASSIGN_HITS', 2, 'AFB')
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Duranium Armor repairs dreadnought since it didn't use sustain
    t.advanceRound(0)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(false)
  })
})
