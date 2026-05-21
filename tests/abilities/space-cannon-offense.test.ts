import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('SPACE_CANNON_OFFENSE', () => {
  it('sacrifices the unit first in the target side custom SCO priority', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { PDS: 1, CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, DESTROYER: 1 },
        abilities: {
          SPACE_CANNON_OFFENSE: {
            customPriority: true,
            unitPriority: [['CRUISER'], ['DESTROYER']],
          },
        },
      },
    })

    // Attacker PDS fires Space Cannon; force 1 hit onto the defender.
    t.advanceTo('SPACE_COMBAT', { defender: 1 })

    // CRUISER is first in the defender's custom SCO priority → it dies.
    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.defender.units.DESTROYER).toHaveLength(1)
  })

  it('honors a reversed custom SCO priority (override drives the choice)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { PDS: 1, CRUISER: 1 } },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, DESTROYER: 1 },
        abilities: {
          SPACE_CANNON_OFFENSE: {
            customPriority: true,
            unitPriority: [['DESTROYER'], ['CRUISER']],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', { defender: 1 })

    // DESTROYER is now first → it dies instead.
    expect(t.defender.units.DESTROYER).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })
})
