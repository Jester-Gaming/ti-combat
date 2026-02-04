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

    t.advanceTo('SPACE_CANNON_DEFENSE')
    const pool = t.dicePool()!

    // Sardakk Dreadnought (Exotrireme) bombardment: base [4, 2]
    // +1 die from Plasma Scoring = 3 dice
    // +4 hit value from Bunker = hit value 8
    expect(pool.attacker).toContainDice('DREADNOUGHT', [8, 3])
  })
})
