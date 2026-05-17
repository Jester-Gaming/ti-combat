import { describe, expect, it } from 'vitest'

import type { CombatStateConfig } from '@/hooks/combat-setup/build-combat-state'

import { all, currentUses, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

// Bomb dice: 3 INF at hit value 8 → per-die p = 0.3. Natural Binomial(3, 0.3)
// has hit distribution 0.343 / 0.441 / 0.189 / 0.027. Defender's Scramble has
// uses=1 and the default strategy `IF_HITS_PERCENT_GE 50` — "reroll when the
// roll is in the better-than-median half of its own marginal." Against
// Binomial(3, 0.3) that means: fires on natural 2 or 3 hits, skips on 0 or 1.
//
// On the OPP-bomb (Bastion → ARB) the predicate runs as authored: 2-3 hits
// are bad for ARB → reroll. After the reroll, those branches sit at
// Binomial(3, 0.3) again — the high tail flattens out.
//
// On the SELF-bomb (Bastion → Bastion) the engine flips MISSES↔HITS and
// negates `rerollIf` so ARB's intent is preserved against self-routed dice
// (high hits-on-Bastion are good for ARB, not bad). The negated predicate
// fires on natural 0 or 1 hits, skipping 2 or 3.

const baseConfig: CombatStateConfig = {
  mode: 'GROUND',
  attacker: {
    faction: 'LAST_BASTION',
    units: { INFANTRY: 3 },
    abilities: {
      PROXIMA_TARGETING_VI: { isEnabled: true, resolveBombardment: true },
    },
  },
  defender: {
    faction: 'ARBOREC',
    units: { INFANTRY: 3 },
    abilities: { SCRAMBLE_FREQUENCY: { isEnabled: true } },
  },
}

describe('PROXIMA_TARGETING_VI + SCRAMBLE_FREQUENCY', () => {
  it('Scramble reduces opp-bomb hits; self-bomb is unaffected (use depleted)', () => {
    // Opp-bomb fires first (LIFO). Branches collapse to a 6-cell grid keyed by
    // (defender hits, defender's remaining Scramble uses). `uses=undefined`
    // means the liveAbilities overlay was never touched — Scramble didn't
    // fire on that branch. `uses=0` means the use was consumed.
    //
    //   nat=0 (0.343), nat=1 (0.441): predicate skips → uses=undefined.
    //   nat=2 (0.189), nat=3 (0.027): predicate fires → reroll all 3 dice at
    //     p=0.3 → Binomial(3, 0.3) again, with uses billed once. Mass
    //     0.189+0.027=0.216 is redistributed across (defH ∈ 0..3, uses=0).
    const t = combatTest(baseConfig)
    const oppBranches = t.advance()
    expect(oppBranches).toHaveBranches(
      all(
        pendingHits('defender'),
        currentUses('defender', 'SCRAMBLE_FREQUENCY'),
      ),
      [
        { value: [0, undefined], probability: 0.343 },
        { value: [1, undefined], probability: 0.441 },
        { value: [0, 0], probability: 0.074088 },
        { value: [1, 0], probability: 0.095256 },
        { value: [2, 0], probability: 0.040824 },
        { value: [3, 0], probability: 0.005832 },
      ],
    )

    // Pick a branch where Scramble fired on opp-bomb (use depleted). The
    // self-bomb's `isCallable` skips Scramble because uses=0, so the dice
    // resolve naturally: Binomial(3, 0.3) on the attacker hit pool.
    const oppFired = oppBranches.find(
      b =>
        pendingHits('defender')(b) === 0 &&
        currentUses('defender', 'SCRAMBLE_FREQUENCY')(b) === 0,
    )!
    const selfAfterFired = oppFired.state.advance()
    expect(selfAfterFired).toHaveBranches(pendingHits('attacker'), [
      { value: 0, probability: 0.343 },
      { value: 1, probability: 0.441 },
      { value: 2, probability: 0.189 },
      { value: 3, probability: 0.027 },
    ])
  })

  it("Scramble doesn't fire on a bad opp-bomb; engine-flip boosts the self-bomb", () => {
    // Pick a branch where Scramble did NOT fire on opp-bomb (natural 0 hits,
    // use still available). Self-bomb runs with the engine-flipped predicate
    // negated: fires on natural 0 or 1 hits, skips on 2 or 3.
    //
    //   nat=0 (0.343): negated predicate fires → reroll all → Binomial(3,0.3)
    //                  branches at uses=0 with mass 0.343*{0.343,0.441,0.189,0.027}
    //                  = 0.117649, 0.151263, 0.064827, 0.009261.
    //   nat=1 (0.441): fires → reroll all → Binomial(3,0.3) at uses=0 with
    //                  mass 0.441*{0.343,0.441,0.189,0.027}
    //                  = 0.151263, 0.194481, 0.083349, 0.011907.
    //   nat=2 (0.189), nat=3 (0.027): negated predicate skips → uses untouched.
    //
    // Merging the two reroll-fired blocks by attacker hits (uses=0):
    //   attH=0: 0.117649 + 0.151263 = 0.268912
    //   attH=1: 0.151263 + 0.194481 = 0.345744
    //   attH=2: 0.064827 + 0.083349 = 0.148176
    //   attH=3: 0.009261 + 0.011907 = 0.021168
    // Plus the two non-firing branches:
    //   attH=2 / uses=undefined: 0.189
    //   attH=3 / uses=undefined: 0.027
    //
    // The marginal `pendingHits('attacker')` is 0.268912 / 0.345744 / 0.337176
    // / 0.048168 — strictly more mass at the high end than natural Binomial(3,
    // 0.3) = 0.343 / 0.441 / 0.189 / 0.027 (i.e. more hits on Bastion → good
    // for ARB).
    const t = combatTest(baseConfig)
    const oppBranches = t.advance()
    const oppNotFired = oppBranches.find(
      b =>
        pendingHits('defender')(b) === 0 &&
        currentUses('defender', 'SCRAMBLE_FREQUENCY')(b) === undefined,
    )!

    const selfAfterNotFired = oppNotFired.state.advance()
    expect(selfAfterNotFired).toHaveBranches(
      all(
        pendingHits('attacker'),
        currentUses('defender', 'SCRAMBLE_FREQUENCY'),
      ),
      [
        { value: [0, 0], probability: 0.268912 },
        { value: [1, 0], probability: 0.345744 },
        { value: [2, 0], probability: 0.148176 },
        { value: [3, 0], probability: 0.021168 },
        { value: [2, undefined], probability: 0.189 },
        { value: [3, undefined], probability: 0.027 },
      ],
    )
  })
})
