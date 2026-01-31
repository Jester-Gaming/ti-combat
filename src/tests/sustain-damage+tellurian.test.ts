import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('SUSTAIN_DAMAGE + TELLURIAN', () => {
  it('both abilities absorb hits independently', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { DREADNOUGHT: 1 },
        abilities: {
          TELLURIAN: { isEnabled: true, uses: 1 },
        },
      },
    })

    t.setPhase('SPACE_COMBAT', 'ASSIGN_HITS')
    t.addHits('defender', 2)
    t.runTiming('BEFORE_ASSIGN_HITS')

    // Dreadnought sustained 1 hit (marked as damaged)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

    // Both abilities absorbed hits, dreadnought survives assignment
    t.assignHits()
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
  })
})
