import { describe, expect, it } from 'vitest'

import { all, currentUses, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('HEART_OF_IXTH', () => {
  it("target='own': single use shared across a multi-die unit (FLAGSHIP)", () => {
    // ARBOREC FLAGSHIP [7,2] rolls 2 dice with HEART_OF_IXTH (1 use, own +1).
    // Per die: hit 7-10 (0.4), flip+ face 6 (0.1), miss 1-5 (0.5).
    // The single use can flip AT MOST ONE face-6 across the two dice.
    //
    // 2-die class counts (h, f, m) with probabilities:
    //   (2,0,0)=0.16 → 2 hits, no flip, uses=1
    //   (1,1,0)=0.08 → 2 hits (nat + flipped), uses=0
    //   (1,0,1)=0.40 → 1 hit,  no flip, uses=1
    //   (0,2,0)=0.01 → 1 hit  (one of two fp flipped, other stays miss), uses=0
    //   (0,1,1)=0.10 → 1 hit  (fp flipped), uses=0
    //   (0,0,2)=0.25 → 0 hits, no flip, uses=1
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { FLAGSHIP: 1 },
        abilities: {
          HEART_OF_IXTH: { isEnabled: true, uses: 1, target: 'own' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(pendingHits('defender'), currentUses('attacker', 'HEART_OF_IXTH')),
      [
        { value: [2, 1], probability: 0.16 },
        { value: [2, 0], probability: 0.08 },
        { value: [1, 1], probability: 0.4 },
        { value: [1, 0], probability: 0.11 },
        { value: [0, 1], probability: 0.25 },
      ],
    )
  })

  it("target='opponent': single use shared across opponent's multi-die unit", () => {
    // Defender ARBOREC FLAGSHIP [7,2] rolls 2 dice. Attacker holds
    // HEART_OF_IXTH (1 use, opponent -1) — applies -1 to defender dice.
    // Per defender die: hit 8-10 (0.3), flip- face 7 (0.1), miss 1-6 (0.6).
    // The single use can flip AT MOST ONE face-7 to a miss.
    //
    // 2-die class counts (h, f, m) for defender:
    //   (2,0,0)=0.09 → 2 hits, no flip, uses=1
    //   (1,1,0)=0.06 → 1 hit  (nat + flipped fn → miss), uses=0
    //   (1,0,1)=0.36 → 1 hit, no flip, uses=1
    //   (0,2,0)=0.01 → 1 hit  (one of two fn flipped, other stays hit), uses=0
    //   (0,1,1)=0.12 → 0 hits (fn flipped), uses=0
    //   (0,0,2)=0.36 → 0 hits, no flip, uses=1
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          HEART_OF_IXTH: { isEnabled: true, uses: 1, target: 'opponent' },
        },
      },
      defender: { faction: 'ARBOREC', units: { FLAGSHIP: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(pendingHits('attacker'), currentUses('attacker', 'HEART_OF_IXTH')),
      [
        { value: [2, 1], probability: 0.09 },
        { value: [1, 0], probability: 0.07 },
        { value: [1, 1], probability: 0.36 },
        { value: [0, 0], probability: 0.12 },
        { value: [0, 1], probability: 0.36 },
      ],
    )
  })
})
