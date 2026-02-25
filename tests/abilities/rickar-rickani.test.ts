import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('RICKAR_RICKANI', () => {
  it('applies -2 to all combat rolls in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { CRUISER: 1, DREADNOUGHT: 1 },
        abilities: { RICKAR_RICKANI: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser: 7 - 2(Rickar) = 5
    expect(pool.attacker).toContainDice('CRUISER', [5, 1])
    // Dreadnought: 5 - 2(Rickar) = 3
    expect(pool.attacker).toContainDice('DREADNOUGHT', [3, 1])
  })

  it('applies -2 to all combat rolls in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'WINNU',
        units: { INFANTRY: 2 },
        abilities: { RICKAR_RICKANI: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()

    // Infantry: 8 - 2(Rickar) = 6
    expect(pool.attacker).toContainDice('INFANTRY', [6, 1])
  })

  it('does not affect AFB rolls', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { DESTROYER: 1 },
        abilities: { RICKAR_RICKANI: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1, FIGHTER: 2 } },
    })

    t.advanceTo('AFB', 'ASSIGN_HITS', 0)
    const pool = t.dicePool()

    // AFB: [9, 2] unmodified
    expect(pool.attacker).toContainDice('DESTROYER', [9, 2])
  })

  it('does not affect Space Cannon Offense rolls', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { CRUISER: 1, PDS: 1 },
        abilities: { RICKAR_RICKANI: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('AFB')
    const pool = t.dicePool()

    // SCO: PDS [6, 1] unmodified
    expect(pool.attacker).toContainDice('PDS', [6, 1])
  })

  it('does not affect Space Cannon Defense rolls', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
      },
      defender: {
        faction: 'WINNU',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: { RICKAR_RICKANI: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool()

    // SCD: PDS [6, 1] unmodified
    expect(pool.defender).toContainDice('PDS', [6, 1])
  })

  it('does not affect Bombardment rolls', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'WINNU',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
        abilities: { RICKAR_RICKANI: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // Bombardment: Dreadnought [5, 1] unmodified
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
  })
})
