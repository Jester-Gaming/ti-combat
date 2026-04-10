import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('FLEET_POOL', () => {
  it('removes excess non-fighter ships from initial setup', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        // 3 cruisers + 1 carrier = 4 non-fighters, pool = 3
        units: { CRUISER: 3, CARRIER: 1, FIGHTER: 2 },
        abilities: {
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 3,
            shipPriority: ['CRUISER', 'CARRIER'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Carrier removed (lowest priority), cruisers kept
    expect(t.attacker.units.CRUISER).toHaveLength(3)
    expect(t.attacker.units.CARRIER).toBeUndefined()
    // Fighters untouched
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })

  it('respects ship priority ordering for removal', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        // 2 cruisers + 1 destroyer + 1 carrier = 4 non-fighters, pool = 2
        units: { CRUISER: 2, DESTROYER: 1, CARRIER: 1 },
        abilities: {
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 2,
            // Keep cruisers, remove destroyer and carrier first
            shipPriority: ['CRUISER', 'DESTROYER', 'CARRIER'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.attacker.units.CRUISER).toHaveLength(2)
    expect(t.attacker.units.DESTROYER).toBeUndefined()
    expect(t.attacker.units.CARRIER).toBeUndefined()
  })

  it('removes unlisted ships before listed ones', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        // 1 cruiser + 1 carrier + 1 destroyer = 3 non-fighters, pool = 1
        units: { CRUISER: 1, CARRIER: 1, DESTROYER: 1 },
        abilities: {
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 1,
            // Only cruiser listed — carrier and destroyer are unlisted
            shipPriority: ['CRUISER'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.CARRIER).toBeUndefined()
    expect(t.attacker.units.DESTROYER).toBeUndefined()
  })

  it('fighters do not count toward fleet pool', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        // 1 cruiser = 1 non-fighter, 5 fighters don't count
        units: { CRUISER: 1, FIGHTER: 5 },
        abilities: {
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 1,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(5)
  })

  it('does nothing when under the limit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        // 2 non-fighters, pool = 3 → no excess
        units: { CRUISER: 1, CARRIER: 1 },
        abilities: {
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 3,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.CARRIER).toHaveLength(1)
  })

  it('upgraded fighters count toward fleet pool (cost 1)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        // 1 cruiser (cost 1) + 3 fighters II (cost 1 each) = 4 total, pool = 3
        units: { CRUISER: 1, FIGHTER: 3 },
        upgrades: ['FIGHTER'],
        abilities: {
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

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // 1 fighter removed (lowest priority), cruiser + 2 fighters kept
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })

  it('naalu upgraded fighters count as 0.5 each', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        // 1 cruiser (cost 1) + 4 naalu fighters II (cost 0.5 each = 2) = 3 total, pool = 3
        units: { CRUISER: 1, FIGHTER: 4 },
        upgrades: ['FIGHTER'],
        abilities: {
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

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Total cost = 1 + 4*0.5 = 3 = pool → no removal
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(4)
  })

  it('naalu upgraded fighters removed when exceeding pool', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        // 1 cruiser (cost 1) + 6 naalu fighters II (cost 0.5 each = 3) = 4 total, pool = 3
        units: { CRUISER: 1, FIGHTER: 6 },
        upgrades: ['FIGHTER'],
        abilities: {
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

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    // Total = 1 + 6*0.5 = 4, excess = 1 → remove 2 fighters (2*0.5 = 1)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(4)
  })

  it('does nothing when disabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        // 4 non-fighters, pool = 2, but disabled
        units: { CRUISER: 2, CARRIER: 2 },
        abilities: {
          FLEET_POOL: {
            isEnabled: false,
            fleetPool: 2,
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.attacker.units.CRUISER).toHaveLength(2)
    expect(t.attacker.units.CARRIER).toHaveLength(2)
  })
})
