import './utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('TEKKLAR_LEGION', () => {
  it('improves own dice and worsens Sardakk opponent dice', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: {
          TEKKLAR_LEGION: true,
        },
      },
      defender: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 2 },
      },
    })

    t.setPhase('GROUND_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Attacker: 8 - 1(tekklar) = 7
    expect(dice.attacker).toContainDice('INFANTRY', [7, 1])
    // Defender (Sardakk): 7 + 1(tekklar penalty) = 9
    expect(dice.defender).toContainDice('INFANTRY', [8, 1])
  })

  it('only improves own dice, does not affect opponent vs non-Sardakk', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: {
          TEKKLAR_LEGION: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.setPhase('GROUND_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Attacker: 8 - 1(tekklar) = 7
    expect(dice.attacker).toContainDice('INFANTRY', [7, 1])
    // Defender (not Sardakk): unchanged at 8
    expect(dice.defender).toContainDice('INFANTRY', [8, 1])
  })
})
