import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ARC_SECUNDUS', () => {
  it('repairs flagship at the start of each combat round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: flagship sustains 1 hit
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Round 2: Arc Secundus repairs flagship at START_OF_COMBAT_ROUND
    t.advanceRound()
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(false)
    expect(t.abilityLog('ARC_SECUNDUS')).not.toHaveLength(0)
  })
})
