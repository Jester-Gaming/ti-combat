import './utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('SARDAKK_FLAGSHIP + UNRELENTING', () => {
  it('applies Unrelenting to all and flagship aura to non-flagship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: {
          UNRELENTING: true,
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
      },
    })

    t.setPhase('SPACE_COMBAT', 'DICE_ROLL')
    const dice = t.runDiceTiming('COMBAT')

    // Flagship: 6 - 1(unrelenting) = 5 (aura doesn't apply to self)
    expect(dice.attacker).toContainDice('FLAGSHIP', [5, 2])
    // Cruiser: 7 - 1(unrelenting) - 1(flagship aura) = 5
    expect(dice.attacker).toContainDice('CRUISER', [5, 1])
  })
})
