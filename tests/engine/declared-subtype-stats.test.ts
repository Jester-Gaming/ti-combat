import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('declareSubtype stats pre-population', () => {
  it('populates s.unitStats for declared subtypes at combat start', () => {
    // Pre-galvanized declares Galvanized for any base unit type with a
    // non-zero count via `declareSubtype` + `galvanizeStats` factory.
    // Verify that CRUISER:Galvanized stats are present in unitStats *before*
    // any galvanizeUnit / addSubtype call has run on a unit.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['CRUISER', 1]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    // advanceTo stops *before* the target phase executes — so PREPARE has
    // moved one CRUISER to CRUISER:Galvanized, and the variant stats must
    // already exist in s.unitStats.
    t.advanceTo('SPACE_COMBAT')

    const stats = t.state.attacker.unitStats as Record<string, unknown>
    expect(stats['CRUISER:Galvanized']).toBeDefined()
  })

  it('applies the statsFactory transform — Galvanized adds a bonus die', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['CRUISER', 1]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // CRUISER base COMBAT [7, 1] → galvanized [7, 1, +1]. The dice pool
    // shows the effective [hit, dice, bonus] tuple via `toContainDice`.
    const pool = t.dicePool()
    expect(pool.attacker).toContainDice('CRUISER', [7, 2])
  })
})
