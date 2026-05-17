import { describe, expect, it } from 'vitest'

import { all, currentUses, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

// Per-die face buckets (same as the limit=1 case):
//   H  (faces 7-10, 0.4): natural hit
//   t1 (face 6,    0.1): tier-1 miss (1 use to flip)
//   t2 (face 5,    0.1): tier-2 miss (2 uses to flip)
//   M  (faces 1-4, 0.4): unflippable with max-per-die +2
describe('HEART_OF_IXTH + WRATH_OF_KENARA', () => {
  it('both stack to +2 — flagship dice get effective +2 conversion budget', () => {
    // Joint outcomes over 2 dice with greedy budget allocation:
    //   (2,0,0,0) 0.16 → 2 hits, 0 uses (heart=1, wrath=1)
    //   (1,1,0,0) 0.08 → 2 hits, 1 use  (heart=0, wrath=1)
    //   (1,0,1,0) 0.08 → 2 hits, 2 uses (heart=0, wrath=0)
    //   (1,0,0,1) 0.32 → 1 hit,  0 uses (heart=1, wrath=1)
    //   (0,2,0,0) 0.01 → 2 hits, 2 uses (heart=0, wrath=0)
    //   (0,1,1,0) 0.02 → 1 hit,  1 use  (heart=0, wrath=1)
    //   (0,1,0,1) 0.08 → 1 hit,  1 use  (heart=0, wrath=1)
    //   (0,0,2,0) 0.01 → 1 hit,  2 uses (heart=0, wrath=0)
    //   (0,0,1,1) 0.08 → 1 hit,  2 uses (heart=0, wrath=0)
    //   (0,0,0,2) 0.16 → 0 hits, 0 uses (heart=1, wrath=1)
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { FLAGSHIP: 1 },
        abilities: {
          WRATH_OF_KENARA: { uses: 1 },
          HEART_OF_IXTH: { isEnabled: true, uses: 1, target: 'own' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(
        pendingHits('defender'),
        currentUses('attacker', 'HEART_OF_IXTH'),
        currentUses('attacker', 'WRATH_OF_KENARA'),
      ),
      [
        { value: [0, 1, 1], probability: 0.16 },
        { value: [1, 1, 1], probability: 0.32 },
        { value: [1, 0, 1], probability: 0.1 },
        { value: [1, 0, 0], probability: 0.09 },
        { value: [2, 1, 1], probability: 0.16 },
        { value: [2, 0, 1], probability: 0.08 },
        { value: [2, 0, 0], probability: 0.09 },
      ],
    )
  })

  it('Kenara uses=2 — extra budget enables a third flip across both dice', () => {
    // Joint outcomes over 2 dice with greedy budget=3 allocation:
    //   (2,0,0,0) 0.16 → 2 hits, 0 uses (heart=1, kenara=2)
    //   (1,1,0,0) 0.08 → 2 hits, 1 use  (heart=0, kenara=2)
    //   (1,0,1,0) 0.08 → 2 hits, 2 uses (heart=0, kenara=1)
    //   (1,0,0,1) 0.32 → 1 hit,  0 uses (heart=1, kenara=2)
    //   (0,2,0,0) 0.01 → 2 hits, 2 uses (heart=0, kenara=1)
    //   (0,1,1,0) 0.02 → 2 hits, 3 uses (heart=0, kenara=0)
    //   (0,1,0,1) 0.08 → 1 hit,  1 use  (heart=0, kenara=2)
    //   (0,0,2,0) 0.01 → 1 hit,  2 uses (heart=0, kenara=1)
    //   (0,0,1,1) 0.08 → 1 hit,  2 uses (heart=0, kenara=1)
    //   (0,0,0,2) 0.16 → 0 hits, 0 uses (heart=1, kenara=2)
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { FLAGSHIP: 1 },
        abilities: {
          WRATH_OF_KENARA: { uses: 2 },
          HEART_OF_IXTH: { isEnabled: true, uses: 1, target: 'own' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(
        pendingHits('defender'),
        currentUses('attacker', 'HEART_OF_IXTH'),
        currentUses('attacker', 'WRATH_OF_KENARA'),
      ),
      [
        { value: [0, 1, 2], probability: 0.16 },
        { value: [1, 1, 2], probability: 0.32 },
        { value: [1, 0, 2], probability: 0.08 },
        { value: [1, 0, 1], probability: 0.09 },
        { value: [2, 1, 2], probability: 0.16 },
        { value: [2, 0, 2], probability: 0.08 },
        { value: [2, 0, 1], probability: 0.09 },
        { value: [2, 0, 0], probability: 0.02 },
      ],
    )
  })
})
