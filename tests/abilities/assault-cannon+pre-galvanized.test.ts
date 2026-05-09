import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('ASSAULT_CANNON + PRE_GALVANIZED', () => {
  it('counts Galvanized cruisers toward the 3-non-fighter-ship threshold', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: {
          ASSAULT_CANNON: true,
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['CRUISER', 3]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('AFB')

    // Bug: strict countUnits(['CRUISER','DESTROYER',…]) = 0 → ability skips →
    // defender keeps their cruiser.
    expect(t.abilityLog('ASSAULT_CANNON')).not.toHaveLength(0)
    expect(t.defender.units.CRUISER).toBeUndefined()
  })
})
