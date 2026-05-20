import { describe, expect, it } from 'vitest'

import { pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('AGNLAN_OLN + PROXIMA_TARGETING_VI', () => {
  it('rerolls misses on opp-bomb, but rerolls hits on self-bomb (engine flips for self-routed dice)', () => {
    // LB attacker rolls 2 Proxima bombs of 8 (×3) — one against the opponent
    // and one against itself. Agnlan declares `target: 'MISSES'` blindly.
    // The engine flips MISSES→HITS for the self-routed dice so the player's
    // intent (reroll bad rolls) holds for both directions: more hits on
    // opponent, fewer hits on self.
    //
    // Bomb dice: 3 INF dice at hit value 8 (faces 8-10 hit) → p = 0.3.
    //
    // Opp-bomb (target='MISSES'): reroll the misses, keep the hits.
    //   Per die P(hit) = 0.3 + 0.7 * 0.3 = 0.51 → Binomial(3, 0.51) on
    //   defender's hit pool: 0.117649 / 0.367353 / 0.382347 / 0.132651.
    //
    // Self-bomb (engine flip → target='HITS'): reroll the hits, keep nothing.
    //   Each natural hit (p=0.3) gets rerolled at p=0.3 → final P(hit per
    //   die) = 0.09. Distribution is the compound (natural Binomial(3,0.3)
    //   then reroll-hits Binomial(k,0.3)): 0.753571 / 0.223587 / 0.022113 /
    //   0.000729. Hits are produced on the defender's pool (natural opponent)
    //   and swapped to the attacker only after the roll, so the branch
    //   distribution is keyed by defender here.

    // Opp-bomb fires first (LIFO: opp-bomb pushed second, fires first).
    const oppBomb = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
          AGNLAN_OLN: { isEnabled: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })
    const oppBranches = oppBomb.advance()
    expect(oppBranches).toHaveBranches(pendingHits('defender'), [
      { value: 0, probability: 0.117649 },
      { value: 1, probability: 0.367353 },
      { value: 2, probability: 0.382347 },
      { value: 3, probability: 0.132651 },
    ])

    // Self-bomb fires second. Walk past opp-bomb's assignment to the
    // self-bomb's dice roll — opp-bomb hits are independent of self-bomb
    // hits so the conditional distribution matches the marginal.
    const selfBranches = oppBranches[0].state.advance()
    expect(selfBranches).toHaveBranches(pendingHits('defender'), [
      { value: 0, probability: 0.753571 },
      { value: 1, probability: 0.223587 },
      { value: 2, probability: 0.022113 },
      { value: 3, probability: 0.000729 },
    ])
  })
})
