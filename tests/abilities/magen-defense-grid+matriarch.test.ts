import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('MAGEN_DEFENSE_GRID + MATRIARCH', () => {
  it('can target committed fighters with its hit', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: {
          MAGEN_DEFENSE_GRID: {
            isEnabled: true,
            targetPriority: ['FIGHTER', 'INFANTRY'],
          },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    // MDG fires and targets the committed fighter
    expect(t.abilityLog('MAGEN_DEFENSE_GRID')).not.toHaveLength(0)
    expect(t.attacker.units.FIGHTER).toBeUndefined()
  })

  it('targets infantry before fighters based on priority', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAALU_COLLECTIVE',
        units: { FLAGSHIP: 1, FIGHTER: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: {
          MAGEN_DEFENSE_GRID: {
            isEnabled: true,
            targetPriority: ['INFANTRY', 'FIGHTER'],
          },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    // MDG fires and targets infantry first (higher priority)
    expect(t.abilityLog('MAGEN_DEFENSE_GRID')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(1)
  })
})
