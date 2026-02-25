import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DIRECT_HIT + MORDRED + THE_ALASTOR', () => {
  it('Direct Hit destroys sustaining unit as ship via Alastor', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, MECH: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
    })

    // 2 hits: flagship sustains, mech sustains → Direct Hit triggers on mech
    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 2 })

    // Mech should be destroyed by Direct Hit after sustaining
    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)
  })
})
