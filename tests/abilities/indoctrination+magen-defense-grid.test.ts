import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('INDOCTRINATION + MAGEN_DEFENSE_GRID', () => {
  it("Indoctrination removes last infantry, MDG doesn't fire", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 1, MECH: 1 },
        abilities: { INDOCTRINATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: { MAGEN_DEFENSE_GRID: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.abilityLog('MAGEN_DEFENSE_GRID')).toHaveLength(0)
  })
})
