import { describe, expect, it } from 'vitest'

import { unitCount } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('AGNLAN_OLN + STRIKE_WING_ALPHA_II', () => {
  it("Agnlan's modifier=0 reroll preserves SWA II's destroy-infantry trigger", () => {
    // Argent DESTROYER (upgraded → SWA II = AFB[6, 3]: hitValue 6, 3 dice)
    // with a roll trigger on faces 9-10 that destroys one infantry per
    // trigger. AGNLAN_OLN declares `target: 'MISSES'` on AFB dice — only
    // faces 1-5 get rerolled, faces 6-10 stay (including trigger faces).
    //
    // Per AFB die at hitValue=6, after REROLL target='MISSES':
    //   p(hit)             = 0.5 + 0.5 · 0.5 = 0.75
    //   p(trigger | hit)   = |faces ∩ {6..10}|/(11-6) = 2/5 = 0.4
    //   p(trigger)         = 0.75 · 0.4 = 0.30
    //
    // 3 dice → Binomial(3, 0.3) infantry destroyed:
    //   0: 0.7^3          = 0.343 → surviving 4
    //   1: 3 · 0.3 · 0.49 = 0.441 → surviving 3
    //   2: 3 · 0.09 · 0.7 = 0.189 → surviving 2
    //   3: 0.3^3          = 0.027 → surviving 1
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARGENT_FLIGHT',
        units: { DESTROYER: 1 },
        upgrades: ['DESTROYER'],
        abilities: { AGNLAN_OLN: { isEnabled: true } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CARRIER: 1, FIGHTER: 1, INFANTRY: 3 },
      },
    })

    const afbBranches = t.advance()

    expect(afbBranches).toHaveBranches(unitCount('defender', 'INFANTRY'), [
      { value: 3, probability: 0.343 },
      { value: 2, probability: 0.441 },
      { value: 1, probability: 0.189 },
      { value: 0, probability: 0.027 },
    ])
  })
})
