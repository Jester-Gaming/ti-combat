import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('CAVALRY + VISCOUNT_UNLENN', () => {
  it('both select plain Cruiser — affect two different units', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
          VISCOUNT_UNLENN: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming(['START_OF_COMBAT', 'START_OF_COMBAT_ROUND'])

    // Cavalry on Cruiser[0], Viscount on Cruiser[1]
    expect(t.attacker.units.CRUISER![0].subtypes).toContain('Cavalry')
    expect(t.attacker.units.CRUISER![0].subtypes).not.toContain('Viscount')
    expect(t.attacker.units.CRUISER![1].subtypes).toContain('Viscount')

    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    expect(dice.attacker).not.toContainDice('CRUISER', [7, 3])
    expect(dice.attacker).toContainDice('CRUISER', [7, 2])
  })

  it('Viscount targets Cruiser:Cavalry — both affect the same unit', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          CAVALRY: { isEnabled: true, unitType: 'CRUISER' },
          VISCOUNT_UNLENN: {
            isEnabled: true,
            unitType: 'CRUISER:Cavalry',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.runTiming(['START_OF_COMBAT', 'START_OF_COMBAT_ROUND'])

    // Both on Cruiser[0]
    expect(t.attacker.units.CRUISER![0].subtypes).toContain('Cavalry')
    expect(t.attacker.units.CRUISER![0].subtypes).toContain('Viscount')

    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Cavalry Cruiser [7, 2] + 1 from Viscount = [7, 3]
    expect(dice.attacker).toContainDice('CRUISER', [7, 3])
  })
})
