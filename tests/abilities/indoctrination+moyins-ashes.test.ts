import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('INDOCTRINATION + MOYINS_ASHES', () => {
  it('deploys mech instead of infantry when both enabled', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: true, MOYINS_ASHES: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.abilityLog('MOYINS_ASHES')).not.toHaveLength(0)
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it("places infantry when Moyin's Ashes is disabled", () => {
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
    expect(t.abilityLog('MOYINS_ASHES')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('does not deploy when opponent has no infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: true, MOYINS_ASHES: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { MECH: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('INDOCTRINATION')).toHaveLength(0)
    expect(t.abilityLog('MOYINS_ASHES')).toHaveLength(0)
    expect(t.attacker.units.MECH).toBeUndefined()
  })
})
