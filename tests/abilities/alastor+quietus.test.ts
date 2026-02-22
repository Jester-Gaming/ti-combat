import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ALASTOR + QUIETUS', () => {
  it('fires without error when Alastor is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: { QUIETUS: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    // Round 1: sustain
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Round 2: destroyed → Quietus AFTER_DESTROY fires
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
  })
})
