import { describe, expect, it } from 'vitest'

import { unitCount } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('PRE_GALVANIZED + STRIKE_WING_ALPHA_II', () => {
  it('galvanized destroyer: bonus die also triggers on 9/10', () => {
    // 1 normal upgraded destroyer (AFB[6, 3] = 3 dice) plus 1 galvanized
    // upgraded destroyer (PRE_GALVANIZED adds +1 bonus die → 4 dice).
    // 7 dice total at hit value 6. Per die:
    //   p(hit) = 0.5; p(trigger | hit) = 2/5; p(trigger) = 0.2.
    // Total triggers ~ Binomial(7, 0.2):
    //   0: 0.8^7                  = 0.2097152 → 7 surviving
    //   1: 7 · 0.2 · 0.8^6        = 0.3670016 → 6 surviving
    //   2: 21 · 0.04 · 0.8^5      = 0.2752512 → 5 surviving
    //   3: 35 · 0.008 · 0.8^4     = 0.1146880 → 4 surviving
    //   4: 35 · 0.0016 · 0.8^3    = 0.0286720 → 3 surviving
    //   5: 21 · 0.00032 · 0.8^2   = 0.0043008 → 2 surviving
    //   6: 7 · 0.000064 · 0.8     = 0.0003584 → 1 surviving
    //   7: 0.2^7                  = 0.0000128 → 0 surviving
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 2 },
        upgrades: ['DESTROYER'],
        abilities: {
          PRE_GALVANIZED: { galvanizedUnits: [['DESTROYER', 1]] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CARRIER: 1, FIGHTER: 1, INFANTRY: 7 },
      },
    })

    const afbBranches = t.advance()

    expect(afbBranches).toHaveBranches(unitCount('defender', 'INFANTRY'), [
      { value: 7, probability: 0.2097152 },
      { value: 6, probability: 0.3670016 },
      { value: 5, probability: 0.2752512 },
      { value: 4, probability: 0.114688 },
      { value: 3, probability: 0.028672 },
      { value: 2, probability: 0.0043008 },
      { value: 1, probability: 0.0003584 },
      { value: 0, probability: 0.0000128 },
    ])
  })
})
