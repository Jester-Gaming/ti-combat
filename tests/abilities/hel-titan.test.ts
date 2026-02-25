import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('HEL_TITAN', () => {
  it('PDS participates in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { PDS: 1, INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Hel-Titan I: Combat [7, 1]
    expect(pool.defender).toContainDice('PDS', [7, 1])
  })

  it('PDS is a valid hit target in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'TITANS_OF_UL',
        units: { PDS: 1 },
      },
    })

    // 2 hits: 1 absorbed by Sustain Damage, 1 destroys PDS
    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ defender: 2 })

    expect(t.defender.units.PDS).toBeUndefined()
  })
})
