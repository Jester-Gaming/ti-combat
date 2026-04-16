import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('PRE_GALVANIZED', () => {
  it('moves configured units into the Galvanized variant', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: { CRUISER: 1 },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    const cruisers = t.attacker.units.CRUISER!
    expect(cruisers).toHaveLength(2)
    const galvanized = cruisers.filter(u => u.subtypes?.includes('Galvanized'))
    expect(galvanized).toHaveLength(1)
  })

  it('adds +1 combat die to galvanized units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: { CRUISER: 1 },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    t.advanceRound()

    const pool = t.dicePool()
    // Cruiser base combat [7, 1] -> galvanized [7, 2]
    expect(pool.attacker).toContainDice('CRUISER', [7, 2])
  })

  it('adds +1 die to unit abilities on galvanized units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: { DESTROYER: 1 },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { FIGHTER: 1 } },
    })

    // Stops after AFB dice are rolled (attacker AFB from destroyer)
    t.advanceTo('SPACE_COMBAT', 'DICE_ROLL')

    const pool = t.dicePool()
    // Destroyer AFB base [9, 2] -> galvanized [9, 3]
    expect(pool.attacker).toContainDice('DESTROYER', [9, 3])
  })

  it('clamps galvanize count to available units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: { CRUISER: 5 },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    const cruisers = t.attacker.units.CRUISER!
    expect(cruisers).toHaveLength(2)
    const galvanized = cruisers.filter(u => u.subtypes?.includes('Galvanized'))
    expect(galvanized).toHaveLength(2)
  })

  it('leaves non-configured unit types untouched', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, DREADNOUGHT: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: { CRUISER: 1 },
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT', 'START')

    expect(t.attacker.units.CRUISER![0].subtypes).toContain('Galvanized')
    expect(t.attacker.units.DREADNOUGHT![0].subtypes).toBeUndefined()
  })
})
