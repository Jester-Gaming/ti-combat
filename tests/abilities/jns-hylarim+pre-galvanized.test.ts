import { describe, expect, it } from 'vitest'

import { pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('JNS_HYLARIM + PRE_GALVANIZED', () => {
  it('galvanized flagship: bonus die also triggers on 9/10', () => {
    // Galvanized adds +1 bonus die → Hylarim rolls 3 dice instead of 2.
    // FRAGILE -1 still applies: hit on 7+. Per die:
    //   M = faces 1-6   miss            (6/10)
    //   H = faces 7-8   1 hit, no trig  (2/10)
    //   T = faces 9-10  1+2 = 3 hits    (2/10) — roll trigger
    // 3-dice multinomial (m,h,t) with m+h+t=3, total hits = h + 3t:
    //   (3,0,0)=0.216 h=0   (2,1,0)=0.216 h=1   (2,0,1)=0.216 h=3
    //   (1,2,0)=0.072 h=2   (1,1,1)=0.144 h=4   (1,0,2)=0.072 h=6
    //   (0,3,0)=0.008 h=3   (0,2,1)=0.024 h=5   (0,1,2)=0.024 h=7
    //   (0,0,3)=0.008 h=9
    // Group by total hits:
    //   0=0.216  1=0.216  2=0.072  3=0.224  4=0.144
    //   5=0.024  6=0.072  7=0.024  9=0.008
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { FLAGSHIP: 1 },
        abilities: {
          PRE_GALVANIZED: { galvanizedUnits: [['FLAGSHIP', 1]] },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { FIGHTER: 6 },
      },
    })

    t.advanceToTiming('BEFORE_DICE_ROLL')
    const branches = t.step()

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 0, probability: 0.216 },
      { value: 1, probability: 0.216 },
      { value: 2, probability: 0.072 },
      { value: 3, probability: 0.224 },
      { value: 4, probability: 0.144 },
      { value: 5, probability: 0.024 },
      { value: 6, probability: 0.072 },
      { value: 7, probability: 0.024 },
      { value: 9, probability: 0.008 },
    ])
  })
})
