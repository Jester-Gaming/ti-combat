import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

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

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

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

    t.advanceTo('GROUND_COMBAT', 'START')
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

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound({ attacker: 3 })

    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(1)
  })

  it('does not affect ground combat without flagship', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FIGHTER: 2, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Fighters should not roll dice without flagship present
    expect(pool.attacker.FIGHTER).toBeUndefined()
  })

  it('does not affect non-Naalu factions', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { FIGHTER: 2, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Fighters should not roll dice for non-Naalu factions
    expect(pool.attacker.FIGHTER).toBeUndefined()
  })

  it('does not affect space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 2 },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    // Fighters participate in space combat normally (not via Matriarch)
    expect(pool.attacker).toContainDice('FIGHTER', [8, 1])
  })
})
