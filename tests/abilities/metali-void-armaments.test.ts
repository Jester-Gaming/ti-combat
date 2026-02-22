import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('METALI_VOID_ARMAMENTS', () => {
  it('adds [6, 3] dice to AFB for attacker', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { METALI_VOID_ARMAMENTS: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')
    const pool = t.dicePool()!

    expect(pool.attacker).toContainDice('METALI_VOID_ARMAMENTS', [6, 3])
  })

  it('combines with existing AFB dice', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1, CRUISER: 1 },
        abilities: { METALI_VOID_ARMAMENTS: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')
    const pool = t.dicePool()!

    // Destroyer AFB: [9, 2]
    expect(pool.attacker).toContainDice('DESTROYER', [9, 2])
    expect(pool.attacker).toContainDice('METALI_VOID_ARMAMENTS', [6, 3])
  })

  it('produces hits against opponent fighters', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { METALI_VOID_ARMAMENTS: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1, FIGHTER: 3 } },
    })

    // AFB hits: defender receives 2 hits on fighters
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL', { defender: 2 })

    expect(t.defender.units.FIGHTER).toHaveLength(1)
  })
})
