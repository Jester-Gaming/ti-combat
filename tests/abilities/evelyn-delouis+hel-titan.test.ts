import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EVELYN_DELOUIS + HEL_TITAN', () => {
  it('Evelyn can target PDS committed as ground force via Hel-Titan', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: {
          EVELYN_DELOUIS: { isEnabled: true, unitType: 'PDS' },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    expect(t.abilityLog('EVELYN_DELOUIS')).not.toHaveLength(0)

    const pool = t.dicePool()
    // PDS (Hel-Titan) combat: [7, 1], Evelyn adds 1 die -> [7, 2]
    expect(pool.defender).toContainDice('PDS', [7, 2])
  })
})
