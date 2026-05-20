import { describe, expect, it } from 'vitest'

import { all, currentUses, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('HEART_OF_IXTH + JNS_HYLARIM', () => {
  it("Heart's +1 doesn't promote a flipped die into a JNS roll trigger", () => {
    // Jol-Nar FLAGSHIP — FRAGILE shifts effective hitValue to 7. With
    // HEART_OF_IXTH (target='own', uses=1) adding +1 to own dice, face classes
    // for each die at base hitValue=7:
    //   T = trigger faces 9-10  (2/10 = 0.2): JNS roll trigger → 3 hits
    //   H = naturalHit  7-8     (2/10 = 0.2): 1 hit
    //   F = flipEligible+ face 6 (1/10 = 0.1): 0 hits unless Heart flips it
    //   M = definiteMiss 1-5    (5/10 = 0.5): 0 hits
    //
    // KEY INVARIANT: a Heart-flipped F adds 1 plain hit, NOT a JNS trigger.
    // JNS fires only on NATURAL faces 9-10 — Heart's +1 does not promote
    // face 6 (or any other face) to the trigger class. So:
    //   - F flipped contributes 1 hit (not 3)
    //   - the trigger class never grows above its natural face count
    //
    // 2 dice with shared 1 Heart use — at most one F flips. Joint
    // outcomes grouped by (defHits, heartUses):
    //   T+T:           0.04                       → 6 hits, uses=1
    //   T+H, H+T:      2·0.2·0.2 = 0.08           → 4 hits, uses=1
    //   T+F, F+T:      2·0.2·0.1 = 0.04           → 4 hits, uses=0 (F→hit)
    //   T+M, M+T:      2·0.2·0.5 = 0.20           → 3 hits, uses=1
    //   H+H:           0.04                       → 2 hits, uses=1
    //   H+F, F+H:      2·0.2·0.1 = 0.04           → 2 hits, uses=0 (F→hit)
    //   H+M, M+H:      2·0.2·0.5 = 0.20           → 1 hit,  uses=1
    //   F+F:           0.01                       → 1 hit,  uses=0 (one flipped)
    //   F+M, M+F:      2·0.1·0.5 = 0.10           → 1 hit,  uses=0 (F→hit)
    //   M+M:           0.25                       → 0 hits, uses=1
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { FLAGSHIP: 1 },
        abilities: {
          HEART_OF_IXTH: { isEnabled: true, uses: 1, target: 'own' },
        },
      },
      defender: { faction: 'ARBOREC', units: { FIGHTER: 6 } },
    })

    t.advanceToTiming('BEFORE_DICE_ROLL')
    const branches = t.step()

    expect(branches).toHaveBranches(
      all(pendingHits('defender'), currentUses('attacker', 'HEART_OF_IXTH')),
      [
        { value: [6, 1], probability: 0.04 },
        { value: [4, 1], probability: 0.08 },
        { value: [4, 0], probability: 0.04 },
        { value: [3, 1], probability: 0.2 },
        { value: [2, 1], probability: 0.04 },
        { value: [2, 0], probability: 0.04 },
        { value: [1, 1], probability: 0.2 },
        { value: [1, 0], probability: 0.11 },
        { value: [0, 1], probability: 0.25 },
      ],
    )
  })
})
