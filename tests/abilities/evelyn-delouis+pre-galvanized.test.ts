import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EVELYN_DELOUIS + PRE_GALVANIZED', () => {
  it('stacks both bonus dice on the same unit', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'FEDERATION_OF_SOL',
        units: { INFANTRY: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: { INFANTRY: 1 },
          },
          EVELYN_DELOUIS: {
            isEnabled: true,
            unitType: 'INFANTRY:Galvanized',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    const pool = t.dicePool()
    // Spec Ops I: [7, 1] + galvanize (+1) + Evelyn (+1) -> [7, 3]
    expect(pool.attacker).toContainDice('INFANTRY', [7, 3])
  })
})
