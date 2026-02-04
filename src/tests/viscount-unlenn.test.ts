import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('VISCOUNT_UNLENN', () => {
  it('adds 1 die to chosen ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'DREADNOUGHT' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT_ROUND')

    expect(t.attacker.units.DREADNOUGHT![0].subtypes).toContain('Viscount')

    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Dreadnought base: [5, 1] -> [5, 2]
    expect(dice.attacker).toContainDice('DREADNOUGHT', [5, 2])
    // Cruiser unchanged: [7, 1]
    expect(dice.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('subtype removed after dice roll, no extra die next round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'DREADNOUGHT' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT_ROUND')
    expect(t.attacker.units.DREADNOUGHT![0].subtypes).toContain('Viscount')

    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    t.runDiceTiming('COMBAT')

    // Subtype removed after dice roll
    expect(t.attacker.units.DREADNOUGHT![0].subtypes).toBeUndefined()

    // Next round: no extra die
    t.runTiming(['END_OF_COMBAT_ROUND', 'START_OF_COMBAT_ROUND'])
    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Dreadnought back to base: [5, 1]
    expect(dice.attacker).toContainDice('DREADNOUGHT', [5, 1])
  })

  it('does not fire when isEnabled is false', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: {
          VISCOUNT_UNLENN: { isEnabled: false, unitType: 'DREADNOUGHT' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming('START_OF_COMBAT_ROUND')
    expect(t.attacker.units.DREADNOUGHT![0].subtypes).toBeUndefined()

    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Dreadnought unchanged: [5, 1]
    expect(dice.attacker).toContainDice('DREADNOUGHT', [5, 1])
  })
})
