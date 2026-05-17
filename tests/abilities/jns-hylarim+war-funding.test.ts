import { describe, expect, it } from 'vitest'

import { pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('JNS_HYLARIM + WAR_FUNDING', () => {
  it("War Funding's modifier=0 reroll preserves JNS roll-trigger semantics", () => {
    // Jol-Nar FLAGSHIP (FRAGILE → effective hitValue 7). JNS_HYLARIM
    // triggers on natural 9/10, adding 2 extra hits per trigger (3 total).
    // WAR_FUNDING rerolls own MISSES with modifier=0 — post-roll face
    // classes are identical to initial, so a rerolled die landing on 9-10
    // STILL fires the JNS trigger.
    //
    // Per die at hitValue=7 (combining initial + reroll):
    //   T  initial trigger      (0.2)          → 3 hits
    //   H  initial natural hit  (0.2)          → 1 hit
    //   RT rerolled to trigger  (0.6 * 0.2)    → 3 hits
    //   RH rerolled to hit      (0.6 * 0.2)    → 1 hit
    //   RM rerolled to miss     (0.6 * 0.6)    → 0 hits
    //
    // Per die: trigger = 0.32, plain hit = 0.32, miss = 0.36.
    //
    // 2 dice (flagship rolls 2). Joint outcomes by total hits:
    //   2T:    0.32^2 = 0.1024            → 6 hits
    //   T+H:   2·0.32·0.32 = 0.2048       → 4 hits
    //   T+M:   2·0.32·0.36 = 0.2304       → 3 hits
    //   2H:    0.32^2 = 0.1024            → 2 hits
    //   H+M:   2·0.32·0.36 = 0.2304       → 1 hit
    //   2M:    0.36^2 = 0.1296            → 0 hits
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { FLAGSHIP: 1 },
        abilities: {
          WAR_FUNDING: {
            isEnabled: true,
            ownStrategyKind: 'ALWAYS',
            ownStrategyThreshold: 0,
            opponentStrategyKind: 'NEVER',
            opponentStrategyThreshold: 0,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { FIGHTER: 6 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 6, probability: 0.1024 },
      { value: 4, probability: 0.2048 },
      { value: 3, probability: 0.2304 },
      { value: 2, probability: 0.1024 },
      { value: 1, probability: 0.2304 },
      { value: 0, probability: 0.1296 },
    ])
  })
})
