import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('SUSTAIN_DAMAGE + TELLURIAN', () => {
  it('both abilities absorb hits independently', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { DREADNOUGHT: 1 },
        abilities: {
          TELLURIAN: { isEnabled: true, uses: 1 },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ defender: 2 })

    // Dreadnought sustained 1 hit (marked as damaged)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Both abilities absorbed hits, dreadnought survives
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
  })
})
