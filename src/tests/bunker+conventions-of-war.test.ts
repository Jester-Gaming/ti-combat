import { describe, expect, it } from 'vitest'

import { combatTest } from './utils/combat-test'

describe('BUNKER + CONVENTIONS_OF_WAR', () => {
  it('Conventions disables bombardment entirely, Bunker is irrelevant', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          CONVENTIONS_OF_WAR: true,
          BUNKER: true,
        },
      },
    })

    t.setPhase('BOMBARDMENT', 'DICE_ROLL')
    const dice = t.runDiceTiming('BOMBARDMENT')

    // No bombardment dice (Conventions disabled it)
    expect(dice.attacker.DREADNOUGHT).toBeUndefined()
  })
})
