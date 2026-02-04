import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('Salai Sai Corian + The Alastor', () => {
  it('counts ground forces participating as ships via The Alastor', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'WINNU',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, INFANTRY: 2, MECH: 1 },
      },
    })

    // The Alastor adds ground forces as participating ships
    t.runTiming('START_OF_COMBAT')

    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // 1 flagship + 2 infantry + 1 mech = 4 non-fighter ships
    expect(dice.attacker).toContainDice('FLAGSHIP', [7, 4])
  })
})
