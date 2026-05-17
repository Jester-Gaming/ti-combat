import { describe, expect, it } from 'vitest'

import { unitCount } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('HEART_OF_IXTH + STRIKE_WING_ALPHA_II', () => {
  // SWA II's roll-trigger fires on the NATURAL face (9-10 at AFB
  // hitValue 9). Heart's +1 can flip face 8 into a regular hit, but the
  // trigger pass reads the pre-flip face — a Heart-flipped 8 does NOT
  // promote into the trigger range and does NOT destroy infantry.
  //
  // The invariant under test: promoting a miss into a hit must not
  // change the outcome probability of an ability whose trigger reads
  // the natural face. We assert it directly — marginalizing over
  // Heart's use state, the INFANTRY survival distribution under
  // HEART_OF_IXTH must match the distribution with HEART_OF_IXTH
  // disabled, bucket by bucket.
  it('SWA II infantry-destruction marginal matches the no-Heart baseline', () => {
    const buildSim = (withHeart: boolean) =>
      combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARGENT_FLIGHT',
          units: { DESTROYER: 1 },
          upgrades: ['DESTROYER'],
          abilities: withHeart
            ? { HEART_OF_IXTH: { isEnabled: true, uses: 1, target: 'own' } }
            : {},
        },
        defender: {
          faction: 'ARBOREC',
          units: { CARRIER: 1, FIGHTER: 1, INFANTRY: 4 },
        },
      })

    const advanceTwice = (sim: ReturnType<typeof buildSim>) => {
      const branches = sim.advance()
      for (let i = 0; i < branches.length; i++) {
        const next = branches[i].state.advance()
        branches[i] = {
          state: next[0].state,
          probability: branches[i].probability,
        }
      }
      return branches
    }

    const infantryMarginal = (branches: ReturnType<typeof advanceTwice>) => {
      const get = unitCount('defender', 'INFANTRY')
      const dist = new Map<number, number>()
      for (const b of branches) {
        const k = get(b)
        dist.set(k, (dist.get(k) ?? 0) + b.probability)
      }
      return dist
    }

    const heartDist = infantryMarginal(advanceTwice(buildSim(true)))
    const baselineDist = infantryMarginal(advanceTwice(buildSim(false)))

    const keys = new Set([...heartDist.keys(), ...baselineDist.keys()])
    for (const k of keys) {
      expect(heartDist.get(k) ?? 0).toBeCloseTo(baselineDist.get(k) ?? 0, 10)
    }
  })
})
