import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('PRE_GALVANIZED + REVEAL_PROTOTYPE', () => {
  it('preserves the galvanize bonus die after upgrading the unit type', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['CRUISER', 1]],
          },
          REVEAL_PROTOTYPE: {
            isEnabled: true,
            spacePriority: [['CRUISER', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    const pool = t.dicePool()
    // Base cruiser upgraded: [7, 1] -> [6, 1]
    // Galvanized cruiser: [7, 1, 1] -> upgrade bubbles through factory -> [6, 1, 1]
    expect(pool.attacker).toContainDice('CRUISER', [6, 1], [6, 2])
  })

  it('preserves the galvanize AFB bonus die after upgrading the destroyer', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['DESTROYER', 1]],
          },
          REVEAL_PROTOTYPE: {
            isEnabled: true,
            spacePriority: [['DESTROYER', true]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { FIGHTER: 2 } },
    })

    // Stops after AFB dice are rolled
    t.advanceToTiming('ANNOUNCE_RETREAT_STEP')

    const pool = t.dicePool()
    // Destroyer AFB upgraded: [9, 2] -> [6, 3]
    // Galvanized destroyer AFB: [9, 2, 1] -> upgrade bubbles through factory -> [6, 3, 1]
    expect(pool.attacker).toContainDice('DESTROYER', [6, 3], [6, 4])
  })
})
