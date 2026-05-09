import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ALARUM + ARTICLES_OF_WAR', () => {
  it('Articles of War strips Alarum ability from mechs', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          ALARUM: { isEnabled: true, availableUnits: [['INFANTRY', 4]] },
          ARTICLES_OF_WAR: true,
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('ALARUM')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
  })
})
