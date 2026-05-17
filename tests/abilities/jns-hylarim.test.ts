import { describe, expect, it } from 'vitest'

import { pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('JNS_HYLARIM', () => {
  it('adds 2 extra hits per natural 9 or 10 face', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { FLAGSHIP: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 6 },
      },
    })

    // Flagship combat [6, 2] is reduced to 7+ by FRAGILE (-1).
    // Per die:
    //   faces 1-6 = miss        (6/10)
    //   faces 7-8 = 1 hit       (2/10) — no trigger
    //   faces 9-10 = 1+2 = 3 hits (2/10) — roll trigger
    // 2 dice — 9 cartesian outcomes; group by total hits.
    t.advanceToTiming('BEFORE_DICE_ROLL')
    const branches = t.step()

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 0, probability: 0.36 },
      { value: 1, probability: 0.24 },
      { value: 2, probability: 0.04 },
      { value: 3, probability: 0.24 },
      { value: 4, probability: 0.08 },
      { value: 6, probability: 0.04 },
    ])
  })

  it('uses natural face, not modified face, to fire the trigger', () => {
    // FRAGILE -1 cancels MORALE_BOOST +1: net modifier 0, hit at 6+.
    // If the trigger fired on modified face (buggy), the +1 from MB would
    // cause face 8 (mod 9) to trigger. The natural-face contract means
    // only natural 9-10 trigger; face 8 contributes a plain hit only.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { FLAGSHIP: 1 },
        abilities: { MORALE_BOOST: { uses: 1 } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 6 },
      },
    })

    t.advanceToTiming('BEFORE_DICE_ROLL')
    const branches = t.step()

    // Per die (net mod 0, hit at 6+):
    //   faces 1-5 = miss   (5/10)
    //   faces 6-8 = 1 hit  (3/10) — no trigger
    //   faces 9-10 = 3 hits (2/10) — trigger
    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 0, probability: 0.25 },
      { value: 1, probability: 0.3 },
      { value: 2, probability: 0.09 },
      { value: 3, probability: 0.2 },
      { value: 4, probability: 0.12 },
      { value: 6, probability: 0.04 },
    ])
  })
})
