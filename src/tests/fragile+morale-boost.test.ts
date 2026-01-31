import './utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('FRAGILE + MORALE_BOOST', () => {
  it('cancel out while Morale Boost has uses', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
      defender: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { CRUISER: 1 },
        abilities: {
          MORALE_BOOST: { uses: 1 },
        },
      },
    })

    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Cruiser: 7 + 1(fragile) - 1(morale) = 7
    expect(dice.defender).toContainDice('CRUISER', [7, 1])
  })

  it('only Fragile applies when Morale Boost uses are exhausted', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
      defender: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { CRUISER: 1 },
        abilities: {
          MORALE_BOOST: { uses: 0 },
        },
      },
    })

    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Cruiser: 7 + 1(fragile) = 8
    expect(dice.defender).toContainDice('CRUISER', [8, 1])
  })
})
