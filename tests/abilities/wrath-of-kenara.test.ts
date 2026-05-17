import { describe, expect, it } from 'vitest'

import { all, currentUses, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('WRATH_OF_KENARA', () => {
  it('affects a single die with uses=1', () => {
    // 1 Hacan flagship [7,2] with 1 use. Per die: natural hit 7-10 (0.4),
    // flip-eligible face 6 (0.1), miss 1-5 (0.5). One use can flip at most
    // one face-6 to a hit.
    //
    // Joint distribution over 2 dice (shared 1 use, greedy):
    //   both 7-10:        0.16 → 2 hits, 0 use
    //   one 7-10, one 6:  0.08 → 2 hits, 1 use (flip face 6)
    //   one 7-10, one ms: 0.40 → 1 hit,  0 use
    //   both 6:           0.01 → 1 hit,  1 use (flip one)
    //   one 6, one miss:  0.10 → 1 hit,  1 use (flip the 6)
    //   both miss:        0.25 → 0 hits, 0 use
    // → P(0)=0.25, P(1)=0.51, P(2)=0.24
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { FLAGSHIP: 1 },
        abilities: { WRATH_OF_KENARA: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 6 },
      },
    })

    t.advanceToTiming('BEFORE_DICE_ROLL', 0, 'SPACE_COMBAT')
    const branches = t.step()

    expect(branches).toHaveBranches(
      all(pendingHits('defender'), currentUses('attacker', 'WRATH_OF_KENARA')),
      [
        { value: [0, 1], probability: 0.25 },
        { value: [1, 0], probability: 0.11 },
        { value: [1, 1], probability: 0.4 },
        { value: [2, 0], probability: 0.08 },
        { value: [2, 1], probability: 0.16 },
      ],
    )
  })

  it('affects two dice with uses=2', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { FLAGSHIP: 1 },
        abilities: { WRATH_OF_KENARA: { uses: 2 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 6 },
      },
    })

    t.advanceToTiming('BEFORE_DICE_ROLL', 0, 'SPACE_COMBAT')
    const branches = t.step()

    expect(branches).toHaveBranches(
      all(pendingHits('defender'), currentUses('attacker', 'WRATH_OF_KENARA')),
      [
        { value: [0, 2], probability: 0.25 },
        { value: [1, 1], probability: 0.1 },
        { value: [1, 2], probability: 0.4 },
        { value: [2, 0], probability: 0.01 },
        { value: [2, 1], probability: 0.08 },
        { value: [2, 2], probability: 0.16 },
      ],
    )
  })

  it('affects only two dice with uses>2', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { FLAGSHIP: 1 },
        abilities: { WRATH_OF_KENARA: { uses: 12 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 6 },
      },
    })

    t.advanceToTiming('BEFORE_DICE_ROLL', 0, 'SPACE_COMBAT')
    const branches = t.step()

    expect(branches).toHaveBranches(
      all(pendingHits('defender'), currentUses('attacker', 'WRATH_OF_KENARA')),
      [
        { value: [0, 12], probability: 0.25 },
        { value: [1, 11], probability: 0.1 },
        { value: [1, 12], probability: 0.4 },
        { value: [2, 10], probability: 0.01 },
        { value: [2, 11], probability: 0.08 },
        { value: [2, 12], probability: 0.16 },
      ],
    )
  })
})
