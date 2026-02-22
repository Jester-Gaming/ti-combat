import '../utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BLITZ', () => {
  it('gives Bombardment 6 to ships without bombardment', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, CARRIER: 1, INFANTRY: 1 },
        abilities: { BLITZ: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()!

    // Cruiser: no bombardment -> gains [6, 1]
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
    // Carrier: no bombardment -> gains [6, 1]
    expect(pool.attacker).toContainDice('CARRIER', [6, 1])
  })

  it('does not give extra dice to ships that already have Bombardment', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, WAR_SUN: 1, INFANTRY: 1 },
        abilities: { BLITZ: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()!

    // Dreadnought already has Bombardment [5, 1] — no extra dice from Blitz
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
    // War Sun already has Bombardment [3, 3] — no extra dice from Blitz
    expect(pool.attacker).toContainDice('WAR_SUN', [3, 3])
  })

  it('gives dice to multiple qualifying ships', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, DESTROYER: 1, INFANTRY: 1 },
        abilities: { BLITZ: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()!

    // 2 Cruisers + 1 Destroyer = 3 dice groups of [6, 1]
    const cruiserDice = pool.attacker.CRUISER ?? []
    const destroyerDice = pool.attacker.DESTROYER ?? []
    expect(cruiserDice).toHaveLength(2)
    expect(destroyerDice).toHaveLength(1)
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
    expect(pool.attacker).toContainDice('DESTROYER', [6, 1])
  })

  it('does not give bombardment to fighters', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { FIGHTER: 2, CRUISER: 1, INFANTRY: 1 },
        abilities: { BLITZ: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()!

    // Fighters should not get bombardment
    expect(pool.attacker.FIGHTER).toBeUndefined()
    // Cruiser still gets it
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
  })

  it('does nothing when disabled', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, INFANTRY: 1 },
        abilities: { BLITZ: { isEnabled: false } },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()

    // No bombardment dice from Cruiser since Blitz is disabled
    expect(pool?.attacker?.CRUISER).toBeUndefined()
  })

  it('works alongside existing bombardment units', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1, INFANTRY: 1 },
        abilities: { BLITZ: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()!

    // Dreadnought keeps its native bombardment [5, 1]
    expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])
    // Cruiser gains bombardment [6, 1] from Blitz
    expect(pool.attacker).toContainDice('CRUISER', [6, 1])
  })
})
