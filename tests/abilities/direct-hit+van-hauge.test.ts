import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DIRECT_HIT + VAN_HAUGE', () => {
  it('triggers when flagship is destroyed by Direct Hit after sustaining', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 1 hit on attacker: flagship sustains → Direct Hit destroys it → Van Hauge triggers
    t.advanceRound({ attacker: 1 })

    // Van Hauge triggered — all ships destroyed
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.defender.units.CRUISER).toBeUndefined()
  })
})
