import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('INDOCTRINATION', () => {
  it('replaces 1 opponent infantry with own infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('does not fire in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 1 },
        abilities: { INDOCTRINATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, INFANTRY: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('INDOCTRINATION')).toHaveLength(0)
  })

  it('places mech instead of infantry when deployMech is checked', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: { isEnabled: true, deployMech: true } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('does not fire if opponent has no infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { MECH: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('INDOCTRINATION')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })
})
