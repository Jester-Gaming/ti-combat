import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('MAGEN_DEFENSE_GRID + PRE_GALVANIZED', () => {
  it('fires when only structure is a Galvanized PDS', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 2 },
        abilities: {
          MAGEN_DEFENSE_GRID: true,
          PRE_GALVANIZED: { isEnabled: true, galvanizedUnits: [['PDS', 1]] },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    // Bug: strict countUnits(['PDS','SPACE_DOCK']) = 0 → guard fails →
    // ability skips → attacker keeps all 3 infantry.
    expect(t.abilityLog('MAGEN_DEFENSE_GRID')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })
})
