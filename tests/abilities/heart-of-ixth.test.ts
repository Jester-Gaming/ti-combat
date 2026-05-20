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

  // "Any" target declares BOTH a +1 on own dice and a -1 on opponent dice,
  // sharing the single use. In a two-sided ground roll each side has 1 INF at
  // hit value 8: own can flip a face-7 miss into a hit (p=0.1), opponent can
  // flip a face-8 hit into a miss (p=0.1). With uses=1 only ONE flip may
  // happen — when both are available the preference decides which.
  //
  // Outcomes keyed by [defender pending hits (attacker's roll), attacker
  // pending hits (defender's roll), Heart uses remaining]. Per die:
  //   attacker: hit 8-10 (0.3), flip+ face7 (0.1), miss 1-6 (0.6)
  //   defender: hard hit 9-10 (0.2), flip- face8 (0.1), miss 1-7 (0.7)
  it("target='anyPreferOwn': shares one use across both sides, preferring own +1", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          HEART_OF_IXTH: { isEnabled: true, uses: 1, target: 'anyPreferOwn' },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    const branches = t.advance()

    // The both-flippable case (attacker face-7 AND defender face-8, p=0.01)
    // takes the own +1 → [1,1,0], never the opponent -1.
    expect(branches).toHaveBranches(
      all(
        pendingHits('defender'),
        pendingHits('attacker'),
        currentUses('attacker', 'HEART_OF_IXTH'),
      ),
      [
        { value: [1, 1, 1], probability: 0.06 },
        { value: [1, 0, 0], probability: 0.1 },
        { value: [1, 0, 1], probability: 0.21 },
        { value: [1, 1, 0], probability: 0.03 },
        { value: [0, 1, 1], probability: 0.12 },
        { value: [0, 0, 0], probability: 0.06 },
        { value: [0, 0, 1], probability: 0.42 },
      ],
    )
  })

  it("target='anyPreferOpponent': shares one use across both sides, preferring opponent -1", () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          HEART_OF_IXTH: {
            isEnabled: true,
            uses: 1,
            target: 'anyPreferOpponent',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    const branches = t.advance()

    // The both-flippable case (p=0.01) takes the opponent -1 → [0,0,0].
    expect(branches).toHaveBranches(
      all(
        pendingHits('defender'),
        pendingHits('attacker'),
        currentUses('attacker', 'HEART_OF_IXTH'),
      ),
      [
        { value: [1, 1, 1], probability: 0.06 },
        { value: [1, 0, 0], probability: 0.1 },
        { value: [1, 0, 1], probability: 0.21 },
        { value: [1, 1, 0], probability: 0.02 },
        { value: [0, 0, 0], probability: 0.07 },
        { value: [0, 1, 1], probability: 0.12 },
        { value: [0, 0, 1], probability: 0.42 },
      ],
    )
  })

  it("target='anyPreferOwn' with uses:2: budget allows a flip on each side", () => {
    // Same 1v1 setup but two uses. Now the both-flippable case (attacker
    // face-7 AND defender face-8, p=0.01) takes BOTH flips — own +1 and
    // opponent -1 → [1,0,0] (defender takes the extra hit, attacker's hit
    // removed, both uses spent) — which uses:1 could not do.
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: {
          HEART_OF_IXTH: { isEnabled: true, uses: 2, target: 'anyPreferOwn' },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(
        pendingHits('defender'),
        pendingHits('attacker'),
        currentUses('attacker', 'HEART_OF_IXTH'),
      ),
      [
        { value: [0, 0, 2], probability: 0.42 },
        { value: [1, 0, 1], probability: 0.1 },
        { value: [0, 1, 2], probability: 0.12 },
        { value: [0, 0, 1], probability: 0.06 },
        { value: [1, 1, 1], probability: 0.02 },
        { value: [1, 0, 0], probability: 0.01 },
        { value: [1, 0, 2], probability: 0.21 },
        { value: [1, 1, 2], probability: 0.06 },
      ],
    )
  })
})
