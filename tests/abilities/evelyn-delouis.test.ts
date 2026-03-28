import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('EVELYN_DELOUIS', () => {
  it('adds 1 extra die to chosen ground force', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: {
          EVELYN_DELOUIS: {
            isEnabled: true,
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

  it('subtype removed after dice roll, no extra die next round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          EVELYN_DELOUIS: { isEnabled: true, unitType: 'INFANTRY' },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    // Round 1: Evelyn adds extra die
    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool1 = t.dicePool()
    expect(pool1.attacker).toContainDice('INFANTRY', [8, 2])

    // Round 2: no extra die (subtype removed after round 1)
    t.advanceRound()
    const pool2 = t.dicePool()

    // Infantry back to base: [8, 1]
    expect(pool2.attacker).toContainDice('INFANTRY', [8, 1])
  })
})
