import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('GHOM_SEKKUS', () => {
  it('adds configured units during COMMIT_UNITS', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          GHOM_SEKKUS: { isEnabled: true, units: { INFANTRY: 2, MECH: 1 } },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })
})
