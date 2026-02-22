import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DIRECT_HIT + DURANIUM_ARMOR', () => {
  it('cannot repair a unit destroyed by Direct Hit after sustain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DURANIUM_ARMOR: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // 1 hit: Dreadnought sustains, then Direct Hit destroys it
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.abilityLog('DIRECT_HIT')).not.toHaveLength(0)
  })
})
