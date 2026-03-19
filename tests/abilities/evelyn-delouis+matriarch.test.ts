import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('EVELYN_DELOUIS + MATRIARCH', () => {
  it('Evelyn can target fighters committed as ground forces via Matriarch', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 2, INFANTRY: 1 },
        abilities: {
          MATRIARCH: true,
          EVELYN_DELOUIS: { isEnabled: true, unitType: 'FIGHTER' },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    expect(t.abilityLog('EVELYN_DELOUIS')).not.toHaveLength(0)

    const pool = t.dicePool()
    // Hybrid Crystal Fighter I combat: [8, 1], Evelyn adds 1 die -> [8, 2]
    expect(pool.attacker).toContainDice('FIGHTER', [8, 2])
  })
})
