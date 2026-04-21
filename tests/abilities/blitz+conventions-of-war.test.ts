import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BLITZ + CONVENTIONS_OF_WAR', () => {
  it('Conventions of War blocks all bombardment including Blitz-granted', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1, INFANTRY: 1 },
        abilities: {
          BLITZ: true,
          CONVENTIONS_OF_WAR: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { CONVENTIONS_OF_WAR: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()

    // No bombardment dice (CoW blocked BOMBARDMENT)
    expect(pool?.attacker?.DREADNOUGHT).toBeUndefined()
    expect(pool?.attacker?.CRUISER).toBeUndefined()
  })
})
