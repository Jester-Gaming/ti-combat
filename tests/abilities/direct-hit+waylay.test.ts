import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DIRECT_HIT + WAYLAY', () => {
  it('Direct Hit can be played during AFB with Waylay', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: {
          WAYLAY: { isEnabled: true, uses: 1 },
          DIRECT_HIT: { uses: 1 },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
      },
    })

    // Destroyer AFB: [9, 2] each = 4 dice total
    // Waylay makes AFB target all ships → Dreadnought is valid target
    // 1 AFB hit → Dreadnought sustains → Direct Hit destroys it
    // Advance past AFB to SPACE_COMBAT:DICE_ROLL so ASSIGN_HITS runs
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL', 1)

    expect(t.abilityLog('WAYLAY')).not.toHaveLength(0)
    expect(t.abilityLog('DIRECT_HIT')).not.toHaveLength(0)
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })
})
