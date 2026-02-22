import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ASSAULT_CANNON ', () => {
  it('Defender assault cannon does not trigger in 3v3 situation', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { ASSAULT_CANNON: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { ASSAULT_CANNON: true },
      },
    })

    t.advanceTo('AFB')

    expect(t.attacker.units.CRUISER).toHaveLength(3)
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })
})
