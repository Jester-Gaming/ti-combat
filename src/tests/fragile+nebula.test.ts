import './utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('FRAGILE + NEBULA', () => {
  it('cancel each other out for net zero modifier', () => {
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
          NEBULA: true,
          FRAGILE: true,
        },
      },
    })

    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Cruiser: 7 + 1(fragile) - 1(nebula) = 7
    expect(dice.defender).toContainDice('CRUISER', [7, 1])
  })
})
