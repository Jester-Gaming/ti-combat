import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EVELYN_DELOUIS', () => {
  it.fails('adds 1 extra die to chosen ground force', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: {
          EVELYN_DELOUIS: {
            isEnabled: true,
            uses: 1,
            unitType: 'INFANTRY',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()

    expect(t.abilityLog('EVELYN_DELOUIS')).not.toHaveLength(0)

    const pool = t.dicePool()
    // One infantry gets extra die: [8, 2]
    expect(pool.attacker).toContainDice('INFANTRY', [8, 2])
    // Other infantry stays at: [8, 1]
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1])
  })
})
