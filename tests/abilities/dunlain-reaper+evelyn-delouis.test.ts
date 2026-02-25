import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DUNLAIN_REAPER + EVELYN_DELOUIS', () => {
  it.fails('Evelyn can target the deployed mech for an extra die', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { INFANTRY: 2 },
        abilities: {
          DUNLAIN_REAPER: { uses: 1 },
          EVELYN_DELOUIS: { isEnabled: true, uses: 1, unitType: 'MECH' },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    expect(t.abilityLog('DUNLAIN_REAPER')).not.toHaveLength(0)
    expect(t.abilityLog('EVELYN_DELOUIS')).not.toHaveLength(0)

    // Mech should have gotten 2 dice (base 1 + Evelyn 1)
    const pool = t.dicePool()
    // Dunlain Reaper mech: combat 6, Evelyn adds 1 die -> [6, 2]
    expect(pool.attacker).toContainDice('MECH', [6, 2])
  })
})
