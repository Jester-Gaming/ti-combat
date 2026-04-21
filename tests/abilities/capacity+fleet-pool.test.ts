import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('CAPACITY + FLEET_POOL', () => {
  it('excess beyond capacity overflows to fleet pool', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        // Carrier(cap 4) + 8 Fighter IIs (CAPACITY_COST:1, FLEET_POOL_COST:0.5)
        // 4 fit in capacity, 4 excess → 4 × 0.5 = 2 fleet pool
        // Total fleet pool: carrier(1) + 2 = 3 ≤ 8 → all survive
        units: { CARRIER: 1, FIGHTER: 8 },
        upgrades: ['FIGHTER'],
        abilities: {
          CAPACITY: true,
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 8,
            shipPriority: ['CARRIER', 'FIGHTER'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(t.attacker.units.CARRIER).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(8)
  })

  it('removes fighters exceeding both capacity and fleet pool', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        // Cruiser(cap 0) + 6 Fighter IIs: all 6 exceed capacity → 6 × 0.5 = 3 fleet pool
        // Total fleet pool: cruiser(1) + 3 = 4, pool = 3 → excess 1 → remove 2 fighters
        units: { CRUISER: 1, FIGHTER: 6 },
        upgrades: ['FIGHTER'],
        abilities: {
          CAPACITY: true,
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 3,
            shipPriority: ['CRUISER', 'FIGHTER'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(4)
  })

  it('does not check capacity during combat rounds', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        // Carrier(cap 4) + 4 Fighter IIs — within capacity at start
        units: { CARRIER: 1, FIGHTER: 4 },
        upgrades: ['FIGHTER'],
        abilities: {
          CAPACITY: true,
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 1,
            shipPriority: ['CARRIER', 'FIGHTER'],
          },
          UNIT_PRIORITY: {
            spaceUnitPriority: ['CARRIER', 'FIGHTER'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.attacker.units.FIGHTER).toHaveLength(4)

    // Carrier destroyed during round — fighters exceed capacity
    // But during combat, capacity is not checked → all 4 fighters keep fighting
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.CARRIER).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(4)
  })

  it('capacity disabled: fighters do not count against fleet pool', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        // Capacity disabled = infinite → all fighters fit → 0 fleet pool cost
        // Fleet pool: carrier(1) only → 1 ≤ 3 → all survive
        units: { CARRIER: 1, FIGHTER: 6 },
        upgrades: ['FIGHTER'],
        abilities: {
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 3,
            shipPriority: ['CARRIER', 'FIGHTER'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(t.attacker.units.CARRIER).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(6)
  })

  it('fleet pool disabled: excess fighters overflow freely', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        // Fleet pool disabled = infinite → excess fighters overflow without limit
        units: { CARRIER: 1, FIGHTER: 6 },
        upgrades: ['FIGHTER'],
        abilities: { CAPACITY: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    // 6 fighters, 4 capacity, but fleet pool is infinite → all survive
    expect(t.attacker.units.CARRIER).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(6)
  })
})
