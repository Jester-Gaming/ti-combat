import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('GHOM_SEKKUS', () => {
  it('adds configured infantry during COMMIT_UNITS', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { GHOM_SEKKUS: { isEnabled: true, units: { INFANTRY: 3 } } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    expect(t.attacker.units.INFANTRY).toHaveLength(5)
  })

  it('adds configured mechs during COMMIT_UNITS', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { GHOM_SEKKUS: { isEnabled: true, units: { MECH: 2 } } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it('adds both infantry and mechs', () => {
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

  it('does not fire when all counts are 0', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: {
          GHOM_SEKKUS: { isEnabled: true, units: { INFANTRY: 0, MECH: 0 } },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE')

    expect(t.abilityLog('GHOM_SEKKUS')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })
})
