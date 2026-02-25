import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('SLEEPER_CELL + VAN_HAUGE', () => {
  it('SC copies all opponent ships destroyed by Van Hauge chain', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: {
          SLEEPER_CELL: { isEnabled: true, fleetPool: 20 },
        },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: { VAN_HAUGE: true },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    // Round 2: 1 more hit destroys flagship → Van Hauge triggers → all ships destroyed
    t.advanceRound({ defender: 3 })

    expect(t.abilityLog('VAN_HAUGE')).not.toHaveLength(0)
    expect(t.abilityLog('SLEEPER_CELL')).not.toHaveLength(0)
  })

  it('SC can place ships even if all Mentak ships destroyed by VH', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 2 },
        abilities: {
          SLEEPER_CELL: { isEnabled: true, fleetPool: 20 },
        },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1, CRUISER: 2 },
        abilities: {
          VAN_HAUGE: true,
          UNIT_PRIORITY: {
            spaceUnitPriority: ['FLAGSHIP', 'CRUISER'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    // Damage flagship
    t.advanceRound({ defender: 1 })

    // Verify flagship sustained damage
    expect(t.defender.units.FLAGSHIP![0].isDamaged).toBe(true)

    // Kill flagship → VH destroys all ships on both sides
    // SC fires for each destroyer of an opponent ship type
    t.advanceRound({ defender: 1 })

    // Verify flagship was destroyed
    expect(t.defender.units.FLAGSHIP).toBeUndefined()

    // VH destroyed all attacker's ships AND all defender's ships
    // SC should place copies of destroyed defender ships (flagship, cruiser types)
    // Even if all Mentak ships were destroyed, SC still fires
    expect(t.abilityLog('SLEEPER_CELL')).not.toHaveLength(0)
  })
})
