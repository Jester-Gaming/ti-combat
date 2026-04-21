import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('MATRIARCH', () => {
  it('fighters participate in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 2, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Hybrid Crystal Fighter I: [8, 1]
    expect(pool.attacker).toContainDice('FIGHTER', [8, 1])
  })

  it('fighters are valid hit targets in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 1, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.FIGHTER).toBeUndefined()
    expect(t.attacker.units.INFANTRY).toBeUndefined()
  })

  it('fighters are assigned hits after priority units', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 2, INFANTRY: 2 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 3 })

    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(1)
  })

  it('fighters are valid targets for space cannon defense', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 1, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { PDS: 2, INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', { attacker: 2 })

    // Both infantry and fighter destroyed by SCD hits
    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toBeUndefined()
  })
})
