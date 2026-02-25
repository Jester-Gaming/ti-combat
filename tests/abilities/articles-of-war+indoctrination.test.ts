import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ARTICLES_OF_WAR + INDOCTRINATION', () => {
  it.fails("Mech can't be deployed when AoW is enabled", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: {
          INDOCTRINATION: { isEnabled: true, deployMech: true },
          ARTICLES_OF_WAR: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: { ARTICLES_OF_WAR: true },
      },
    })

    t.advanceTo('GROUND_COMBAT', 'DICE_ROLL')

    // Indoctrination fires and deploys a mech
    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.attacker.units.MECH).toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })
})
