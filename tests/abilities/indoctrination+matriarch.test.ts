import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('INDOCTRINATION + MATRIARCH', () => {
  it('cannot replace committed fighters (only targets infantry)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 2 },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 1 },
        abilities: { INDOCTRINATION: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    // Indoctrination should not fire: opponent has no infantry
    expect(t.abilityLog('INDOCTRINATION')).toHaveLength(0)
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })

  it('replaces infantry even when committed fighters are present', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 2, INFANTRY: 1 },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 1 },
        abilities: { INDOCTRINATION: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    // Indoctrination fires: replaces attacker's infantry
    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })
})
