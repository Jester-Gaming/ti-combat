import '../utils/expect'

import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('PLASMA_SCORING + STRIKE_WING_AMBUSCADE + TRRAKAN_AUN_ZULOK', () => {
  it('all three add dice to space cannon roll', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
      defender: {
        faction: 'XXCHA_KINGDOM',
        units: { PDS: 1, CRUISER: 1, DESTROYER: 2 },
        abilities: {
          PLASMA_SCORING: { isEnabled: true, strategy: 'BEST' },
          STRIKE_WING_AMBUSCADE: {
            isEnabled: true,
            uses: 1,
            phases: ['SPACE_CANNON_OFFENSE'],
          },
          TRRAKAN_AUN_ZULOK: {
            isEnabled: true,
            phases: ['SPACE_CANNON_OFFENSE'],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT', 'START')
    const pool = t.dicePool()!

    // PDS base space cannon: [6, 1]
    // +1 die from Plasma Scoring, +1 from SWA, +1 from Commander = [6, 4]
    expect(pool.defender).toContainDice('PDS', [6, 4])
  })
})
