import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DIRECT_HIT + FOURTH_MOON + SUSTAIN_DAMAGE', () => {
  it('re-enables sustain after Fourth Moon flagship is destroyed by Direct Hit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
      defender: {
        faction: 'MENTAK_COALITION',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
    })

    // Flagship sustains -> Direct Hit destroys it -> AFTER_DESTROY re-enables sustain
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1, defender: 1 })

    expect(t.attacker.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.FLAGSHIP).toBeUndefined()
  })
})
