import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('FRAGMENT_REALITY', () => {
  it('places configured ships at start of space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'CRIMSON_REBELLION',
        units: { CRUISER: 1 },
        abilities: {
          FRAGMENT_REALITY: {
            isEnabled: true,
            ships: { CRUISER: 2 },
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('FRAGMENT_REALITY')).toHaveLength(1)
    // 1 original + 2 placed = 3
    expect(t.attacker.units.CRUISER).toHaveLength(3)
  })

  it('places multiple ship types', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'CRIMSON_REBELLION',
        units: { CRUISER: 1 },
        abilities: {
          FRAGMENT_REALITY: {
            isEnabled: true,
            ships: { DESTROYER: 2, FIGHTER: 3 },
            fleetPool: 20,
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
    expect(t.attacker.units.DESTROYER).toHaveLength(2)
    expect(t.attacker.units.FIGHTER).toHaveLength(3)
  })

  it('does not fire when no ships are configured', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'CRIMSON_REBELLION',
        units: { CRUISER: 2 },
        abilities: {
          FRAGMENT_REALITY: { isEnabled: true },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('FRAGMENT_REALITY')).toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })

  it('enforces fleet pool by removing lowest priority ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'CRIMSON_REBELLION',
        // 2 cruisers + 1 carrier = 3 non-fighter ships
        units: { CRUISER: 2, CARRIER: 1 },
        abilities: {
          FRAGMENT_REALITY: {
            isEnabled: true,
            ships: { DESTROYER: 2 },
            // 3 existing + 2 placed = 5, pool = 3 → 2 excess
            fleetPool: 3,
            // Keep cruisers first, then destroyers, carriers last
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

    expect(t.attacker.units.CRUISER).toHaveLength(2) // kept (highest priority)
    expect(t.attacker.units.DESTROYER).toHaveLength(1) // 2 placed, 1 removed
    expect(t.attacker.units.CARRIER).toBeUndefined() // removed (lowest priority)
  })

  it('fighters do not count toward fleet pool', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'CRIMSON_REBELLION',
        // 1 cruiser = 1 non-fighter ship
        units: { CRUISER: 1 },
        abilities: {
          FRAGMENT_REALITY: {
            isEnabled: true,
            ships: { FIGHTER: 5, CRUISER: 1 },
            // 2 cruisers total, pool = 2 → no excess
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

    expect(t.attacker.units.CRUISER).toHaveLength(2) // 1 + 1
    expect(t.attacker.units.FIGHTER).toHaveLength(5) // all kept
  })

  it('removes unlisted ships before listed ones', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'CRIMSON_REBELLION',
        units: { CRUISER: 1, CARRIER: 1 },
        abilities: {
          FRAGMENT_REALITY: {
            isEnabled: true,
            ships: { DESTROYER: 1 },
            // 3 existing + 1 placed = 4, pool = 2 → 2 excess
            fleetPool: 2,
            // Only cruiser in priority, carrier and destroyer are unlisted
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

    expect(t.attacker.units.CRUISER).toHaveLength(1) // kept (listed)
    // Carrier and destroyer are unlisted — both removed
    expect(t.attacker.units.CARRIER).toBeUndefined()
    expect(t.attacker.units.DESTROYER).toHaveLength(1)
  })
})
