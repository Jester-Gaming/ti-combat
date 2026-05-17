import { describe, expect, it } from 'vitest'

import { unitCount } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('STRIKE_WING_ALPHA_II', () => {
  it('destroys 1 opponent infantry per natural 9/10 face', () => {
    // 3 dice, P(face 9/10) = 2/10. Expected infantry distribution:
    //   0 naturals: (8/10)^3 = 0.512 → 3 infantry remain
    //   1 natural:  C(3,1) * 0.2 * 0.8^2 = 0.384 → 2 infantry remain
    //   2 naturals: C(3,2) * 0.04 * 0.8 = 0.096 → 1 infantry remains
    //   3 naturals: 0.2^3 = 0.008 → 0 infantry remain
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 1 },
        upgrades: ['DESTROYER'],
      },
      defender: {
        faction: 'ARBOREC',
        units: { CARRIER: 1, FIGHTER: 1, INFANTRY: 3 },
      },
    })

    const afbBranches = t.advance()

    expect(afbBranches).toHaveBranches(unitCount('defender', 'INFANTRY'), [
      { value: 3, probability: 0.512 },
      { value: 2, probability: 0.384 },
      { value: 1, probability: 0.096 },
      { value: 0, probability: 0.008 },
    ])
  })

  it('2 upgraded destroyers pool their natural 9/10 triggers', () => {
    // 2 destroyers · AFB[6, 3] = 6 dice at hit value 6. Per die:
    //   p(hit) = 0.5; p(trigger | hit) = 2/5; p(trigger) = 0.2.
    // Binomial(6, 0.2) infantry destroyed:
    //   0: 0.8^6                  = 0.262144 → 6 surviving
    //   1: 6 · 0.2 · 0.8^5        = 0.393216 → 5 surviving
    //   2: 15 · 0.04 · 0.8^4      = 0.245760 → 4 surviving
    //   3: 20 · 0.008 · 0.8^3     = 0.081920 → 3 surviving
    //   4: 15 · 0.0016 · 0.8^2    = 0.015360 → 2 surviving
    //   5: 6 · 0.00032 · 0.8      = 0.001536 → 1 surviving
    //   6: 0.2^6                  = 0.000064 → 0 surviving
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 2 },
        upgrades: ['DESTROYER'],
      },
      defender: {
        faction: 'ARBOREC',
        units: { CARRIER: 1, FIGHTER: 1, INFANTRY: 6 },
      },
    })

    const afbBranches = t.advance()

    expect(afbBranches).toHaveBranches(unitCount('defender', 'INFANTRY'), [
      { value: 6, probability: 0.262144 },
      { value: 5, probability: 0.393216 },
      { value: 4, probability: 0.24576 },
      { value: 3, probability: 0.08192 },
      { value: 2, probability: 0.01536 },
      { value: 1, probability: 0.001536 },
      { value: 0, probability: 0.000064 },
    ])
  })

  it('runs without throwing when opponent has no infantry', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 1 },
        upgrades: ['DESTROYER'],
      },
      defender: {
        faction: 'ARBOREC',
        units: { CARRIER: 1, FIGHTER: 1 },
      },
    })

    // Drive through AFB; the chosen branch with 3 hits exercises the
    // effect callback (count > 0) which must no-op cleanly with no infantry.
    t.advanceToTiming('BEFORE_ASSIGN_HITS', 3, 'AFB')

    expect(t.abilityLog('STRIKE_WING_ALPHA_II')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toBeUndefined()
  })
})
