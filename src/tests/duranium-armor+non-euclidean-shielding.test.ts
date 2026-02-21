import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('DURANIUM_ARMOR + NON_EUCLIDEAN_SHIELDING', () => {
  it('does not repair a unit that sustained this round even with NES', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: {
          DURANIUM_ARMOR: true,
          NON_EUCLIDEAN_SHIELDING: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 2 hits: Dreadnought sustains (NES cancels extra hit) → 0 remaining hits
    t.advanceRound({ attacker: 2 })

    // Dreadnought sustained this round → not eligible for repair
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.abilityLog('NON_EUCLIDEAN_SHIELDING')).not.toHaveLength(0)

    // Round 2: 0 hits → Dreadnought didn't sustain → repaired
    t.advanceRound({ attacker: 0 })
    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(false)
  })
})
