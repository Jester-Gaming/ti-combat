import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EIDOLON_MAXIMUM + WAYLAY', () => {
  it('mech is immune to AFB even when Waylay expands targets', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: { WAYLAY: true },
      },
    })

    // Advance past AFB where Waylay makes AFB target all ships
    t.advanceToTiming('ANNOUNCE_RETREAT_STEP', { attacker: 3 })

    // Fighter and Cruiser can be hit, but Mech should survive
    expect(t.attacker.units.MECH).toHaveLength(1)
  })
})
