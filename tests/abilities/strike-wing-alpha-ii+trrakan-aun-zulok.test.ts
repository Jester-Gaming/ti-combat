import { describe, expect, it } from 'vitest'

import { unitCount } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('STRIKE_WING_ALPHA_II + TRRAKAN_AUN_ZULOK', () => {
  it('Trrakan extra AFB die also triggers natural-9/10 destroy', () => {
    // Trrakan Aun Zulok adds +1 die when 1+ units use a unit ability. With
    // SWA II (upgraded Argent destroyer = 3 AFB dice) + Trrakan = 4 AFB
    // dice. The bonus die is part of the same DieGroup as the destroyer's
    // base dice, so it's subject to SWA II's roll trigger on 9/10.
    //
    // Per die: P(face 9/10) = 0.2. With 4 dice, infantry-destroyed
    // distribution (Binomial(4, 0.2)):
    //   0 triggers: 0.8^4 = 0.4096
    //   1 trigger:  4 * 0.2 * 0.512 = 0.4096
    //   2 triggers: 6 * 0.04 * 0.64 = 0.1536
    //   3 triggers: 4 * 0.008 * 0.8 = 0.0256
    //   4 triggers: 0.2^4 = 0.0016
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 1 },
        upgrades: ['DESTROYER'],
        abilities: { TRRAKAN_AUN_ZULOK: { isEnabled: true } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CARRIER: 1, FIGHTER: 1, INFANTRY: 4 },
      },
    })

    const afbBranches = t.advance()

    expect(afbBranches).toHaveBranches(unitCount('defender', 'INFANTRY'), [
      { value: 4, probability: 0.4096 },
      { value: 3, probability: 0.4096 },
      { value: 2, probability: 0.1536 },
      { value: 1, probability: 0.0256 },
      { value: 0, probability: 0.0016 },
    ])
  })
})
