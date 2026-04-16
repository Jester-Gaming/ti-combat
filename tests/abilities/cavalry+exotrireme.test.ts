import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('CAVALRY + EXOTRIREME', () => {
  it('does not sacrifice Dreadnought:Cavalry when excluded from sacrificePriority', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 2 },
        upgrades: ['DREADNOUGHT'],
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'DREADNOUGHT' },
          EXOTRIREME: {
            isEnabled: true,
            sacrificePriority: ['DREADNOUGHT'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    // Only the plain Dreadnought was sacrificed; the Cavalry variant survives.
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].subtypes?.includes('Cavalry')).toBe(
      true,
    )

    // 2 opponent cruisers destroyed by the sacrifice
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('EXOTRIREME')).not.toHaveLength(0)
  })

  it('sacrifices Dreadnought:Cavalry first when it leads the priority list', () => {
    // 2 cruisers = exactly 1 sacrifice needed. Priority puts Cavalry first.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 2 },
        upgrades: ['DREADNOUGHT'],
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'DREADNOUGHT' },
          EXOTRIREME: {
            isEnabled: true,
            sacrificePriority: ['DREADNOUGHT:Cavalry', 'DREADNOUGHT'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    // Cavalry dreadnought sacrificed; plain dreadnought survives.
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].subtypes).toBeFalsy()

    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('EXOTRIREME')).not.toHaveLength(0)
  })

  it('sacrifices plain Dreadnought first when it leads the priority list', () => {
    // 2 cruisers = exactly 1 sacrifice needed. Priority puts plain first.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 2 },
        upgrades: ['DREADNOUGHT'],
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'DREADNOUGHT' },
          EXOTRIREME: {
            isEnabled: true,
            sacrificePriority: ['DREADNOUGHT', 'DREADNOUGHT:Cavalry'],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    // Plain dreadnought sacrificed; Cavalry variant survives.
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.attacker.units.DREADNOUGHT![0].subtypes?.includes('Cavalry')).toBe(
      true,
    )

    expect(t.defender.units.CRUISER).toBeUndefined()
    expect(t.abilityLog('EXOTRIREME')).not.toHaveLength(0)
  })
})
