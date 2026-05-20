import { describe, expect, it } from 'vitest'

import { all, currentUses, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('WAR_FUNDING + WRATH_OF_KENARA', () => {
  it("War Funding's reroll applies before Kenara's flip", () => {
    // Hacan FLAGSHIP [7, 2] with WRATH_OF_KENARA (2 uses, +1 to own dice) and
    // WAR_FUNDING (own dice ALWAYS reroll on misses, opponent reroll
    // disabled). The new math pipeline orders REROLL (step 3) before
    // CONDITIONAL_MODIFIER (step 4): War Funding rerolls every miss
    // (faces 1-6) into a fresh uniform face, then Kenara looks at the
    // post-reroll dice and flips face=6 (its tier-1 hits).
    //
    // Per-die post-reroll face distribution:
    //   initial hit (face 7-10, p=0.4): kept as-is → faces 7-10 stay
    //   initial miss (face 1-6, p=0.6): face uniform 1-10 after reroll
    //
    // So per die unconditionally:
    //   H = final face 7-10 = 0.4 + 0.6 * 0.4 = 0.64 (natural hit)
    //   F = final face 6     = 0       + 0.6 * 0.1 = 0.06 (Kenara flip)
    //   M = final face 1-5   = 0       + 0.6 * 0.5 = 0.30 (definite miss)
    //
    // 2 dice with shared 2 Kenara uses:
    //   H+H:         0.64²        = 0.4096 → 2 hits, uses=0
    //   H+F, F+H:    2·0.64·0.06  = 0.0768 → 2 hits (1 flipped), uses=1
    //   H+M, M+H:    2·0.64·0.30  = 0.384  → 1 hit,  uses=0
    //   F+F:         0.06²        = 0.0036 → 2 hits (both flipped), uses=2
    //   F+M, M+F:    2·0.06·0.30  = 0.036  → 1 hit (flipped),       uses=1
    //   M+M:         0.30²        = 0.09   → 0 hits, uses=0
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { FLAGSHIP: 1 },
        abilities: {
          WRATH_OF_KENARA: { uses: 2 },
          WAR_FUNDING: {
            isEnabled: true,
            ownStrategyKind: 'ALWAYS',
            ownStrategyThreshold: 0,
            opponentStrategyKind: 'NEVER',
            opponentStrategyThreshold: 0,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 6 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(pendingHits('defender'), currentUses('attacker', 'WRATH_OF_KENARA')),
      [
        { value: [2, 2], probability: 0.4096 },
        { value: [2, 1], probability: 0.0768 },
        { value: [2, 0], probability: 0.0036 },
        { value: [1, 2], probability: 0.384 },
        { value: [1, 1], probability: 0.036 },
        { value: [0, 2], probability: 0.09 },
      ],
    )
  })
})
