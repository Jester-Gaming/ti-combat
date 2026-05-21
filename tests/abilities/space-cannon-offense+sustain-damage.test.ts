import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('SPACE_CANNON_OFFENSE + SUSTAIN_DAMAGE', () => {
  it('dreadnought sustains an SCO hit by default', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { PDS: 1, CRUISER: 1 } },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
    })

    // Attacker PDS fires Space Cannon; force 1 hit onto the defender.
    t.advanceTo('SPACE_COMBAT', { defender: 1 })

    // Dreadnought survives by using Sustain Damage.
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT!.some(d => d.isDamaged)).toBe(true)
  })

  it('dreadnought cannot sustain an SCO hit when disableSustainDamage is on', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { SPACE_CANNON_OFFENSE: { disableSustainDamage: true } },
      },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', { defender: 1 })

    // Dreadnought destroyed (no sustain).
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })
})
