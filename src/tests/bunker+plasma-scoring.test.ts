import './utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('BUNKER + PLASMA_SCORING', () => {
  it('Plasma adds a die, Bunker increases hit values', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
        abilities: {
          PLASMA_SCORING: { isEnabled: true, strategy: 'BEST' },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          BUNKER: true,
        },
      },
    })

    t.setPhase('BOMBARDMENT', 'DICE_ROLL')
    const dice = t.runDiceTiming('BOMBARDMENT')

    // Sardakk Dreadnought (Exotrireme) bombardment: base [4, 2]
    // +1 die from Plasma Scoring = 3 dice
    // +4 hit value from Bunker = hit value 8
    expect(dice.attacker).toContainDice('DREADNOUGHT', [8, 3])
  })
})
