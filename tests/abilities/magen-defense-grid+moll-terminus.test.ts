import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('MAGEN_DEFENSE_GRID + MOLL_TERMINUS', () => {
  it('opponent mech cannot sustain MDG hit when Mentak is defender', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { MECH: 1 },
      },
      defender: {
        faction: 'MENTAK_COALITION',
        units: { MECH: 1, SPACE_DOCK: 1 },
        abilities: { MAGEN_DEFENSE_GRID: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    // MDG hit: attacker mech can't sustain (Moll blocks opponent ground forces)
    expect(t.abilityLog('MAGEN_DEFENSE_GRID')).not.toHaveLength(0)
    // Mech destroyed since it can't sustain the 1 hit
    expect(t.attacker.units.MECH).toBeUndefined()
  })
})
