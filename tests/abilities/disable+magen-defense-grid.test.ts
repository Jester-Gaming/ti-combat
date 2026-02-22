import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('DISABLE + MAGEN_DEFENSE_GRID', () => {
  it('Magen Defense Grid still fires when Disable is active', () => {
    // Disable only removes Planetary Shield and Space Cannon from PDS
    // It does not affect Magen Defense Grid
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: { DISABLE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 2 },
        abilities: { MAGEN_DEFENSE_GRID: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('MAGEN_DEFENSE_GRID').length).toBeGreaterThan(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })
})
