import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DIRECT_HIT + DYNAMO', () => {
  it('does not repair a unit destroyed by Direct Hit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { DYNAMO: { uses: 5 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: { DIRECT_HIT: { uses: 1 } },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound({ attacker: 1 })

    // Dreadnought sustained, Direct Hit destroyed it — Dynamo should NOT repair
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
  })
})
