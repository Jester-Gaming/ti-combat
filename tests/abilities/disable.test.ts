import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DISABLE', () => {
  it('strips Space Cannon from opponent PDS', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
        abilities: { DISABLE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
      },
    })

    // Past BOMBARDMENT and SCD
    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()

    // Last dice pool is bombardment (SCD was skipped due to Disable)
    // PDS should not appear in the pool
    expect(pool?.defender?.PDS).toBeUndefined()
  })
})
