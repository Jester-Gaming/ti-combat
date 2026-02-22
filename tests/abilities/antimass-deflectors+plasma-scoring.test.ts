import '../utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ANTIMASS_DEFLECTORS + PLASMA_SCORING', () => {
  it('extra die also gets hit value penalty', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          ANTIMASS_DEFLECTORS: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
        abilities: {
          PLASMA_SCORING: { isEnabled: true, strategy: 'BEST' },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    const pool = t.dicePool()!

    // PDS base space cannon: [6, 1]
    // +1 die from Plasma Scoring = [6, 2]
    // +1 hit value from Antimass = [7, 2]
    expect(pool.defender).toContainDice('PDS', [7, 2])
  })
})
