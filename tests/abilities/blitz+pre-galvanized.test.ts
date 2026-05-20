import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BLITZ + PRE_GALVANIZED', () => {
  it('adds the galvanize bonus die to blitz-granted bombardment', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { CARRIER: 1, INFANTRY: 1 },
        abilities: {
          BLITZ: true,
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['CARRIER', 1]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // Carrier gains Bombardment [6, 1] from Blitz, galvanize adds +1 die -> [6, 2]
    expect(pool.attacker).toContainDice('CARRIER', [6, 2])
  })
})
