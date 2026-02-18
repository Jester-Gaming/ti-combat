import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('CAVALRY + GRAVLEASH_MANEUVERS', () => {
  it('Gravleash does not count subtype as a separate type', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 1, CRUISER: 2, DESTROYER: 1 },
        abilities: {
          GRAVLEASH_MANEUVERS: { isEnabled: true, shipPriority: ['CRUISER'] },
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    expect(
      t.attacker.units.CRUISER!.some(u => u.subtypes?.includes('Cavalry')),
    ).toBe(true)

    const pool = t.dicePool()!
    expect(pool.attacker).toContainDice('CRUISER', [4, 1])
  })

  it('counts subtypes as separate ship types in priority', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { DREADNOUGHT: 1, CRUISER: 2, DESTROYER: 1 },
        abilities: {
          GRAVLEASH_MANEUVERS: {
            isEnabled: true,
            shipPriority: ['CRUISER:Cavalry', 'CRUISER'],
          },
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()
    const pool = t.dicePool()!

    expect(pool.attacker).toContainDice('CRUISER', [4, 2])
  })
})
