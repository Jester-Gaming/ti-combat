import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('L4_DISRUPTORS', () => {
  it('disables opponent space cannon defense', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 2 },
        abilities: { L4_DISRUPTORS: true },
      },
      defender: { faction: 'ARBOREC', units: { PDS: 1, INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT') // past SCD
    const pool = t.dicePool()

    expect(pool?.defender?.PDS).toBeUndefined()
  })

  it('does not block space cannon offense', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { CRUISER: 2 },
        abilities: { L4_DISRUPTORS: true },
      },
      defender: { faction: 'ARBOREC', units: { PDS: 1, CRUISER: 1 } },
    })

    t.advanceTo('AFB') // past SCO
    const pool = t.dicePool()

    // L4 Disruptors is ground-only, should not affect SCO
    expect(pool?.defender).toContainDice('PDS', [6, 1])
  })
})
