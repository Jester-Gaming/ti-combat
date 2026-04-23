import { describe, expect, it } from 'vitest'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

describe('AMBUSH + COURAGEOUS_TO_THE_END', () => {
  it('Ambush hit chains into Courageous — nested split at START_OF_COMBAT', () => {
    // Attacker (Mentak): 1 destroyer (combat 9) with Ambush.
    //   Ambush rolls 1d9 → P(hit) = 0.2, P(miss) = 0.8.
    // Defender (Arborec): 1 destroyer (combat 9) with Courageous.
    //   If Ambush hits, defender destroyer (no sustain) dies → Courageous
    //   fires → rolls 2d9 at combat value 9:
    //     P(0 Courageous hits) = 0.64
    //     P(1+ Courageous hits) = 0.36
    //
    // Expected branches after START_OF_COMBAT:
    //   Miss branch (P=0.8): no chain → 1 branch
    //   Hit branch (P=0.2): Courageous rolls 2d9 → 3 sub-branches
    //     [0 hits]: P=0.2 * 0.64 = 0.128
    //     [1 hit ]: P=0.2 * 0.32 = 0.064
    //     [2 hits]: P=0.2 * 0.04 = 0.008
    // Total: 1 (miss) + 3 (hit chain) = 4 branches.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { DESTROYER: 1 },
        abilities: { AMBUSH: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1 },
        abilities: { COURAGEOUS_TO_THE_END: true },
      },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    expect(branches).toHaveLength(4)

    // The miss branch: defender destroyer still alive, attacker destroyer alive.
    const missBranch = branches.find(
      b =>
        (unitsByBaseType(b.state.data.defender).DESTROYER?.length ?? 0) === 1 &&
        (unitsByBaseType(b.state.data.attacker).DESTROYER?.length ?? 0) === 1,
    )
    expect(missBranch).toBeDefined()
    expect(missBranch!.probability).toBeCloseTo(0.8)

    // Chain branches: defender destroyer destroyed. Group by attacker
    // destroyer remaining (0 or 1 depending on Courageous hits).
    const chainBranches = branches.filter(
      b =>
        (unitsByBaseType(b.state.data.defender).DESTROYER?.length ?? 0) === 0,
    )
    expect(chainBranches).toHaveLength(3)
    const chainTotal = chainBranches.reduce((a, b) => a + b.probability, 0)
    expect(chainTotal).toBeCloseTo(0.2)

    // Sub-distribution of attacker destroyer remaining within chain:
    //   1 destroyer alive: Courageous rolled 0 hits → P = 0.2 * 0.64 = 0.128
    //   0 destroyers alive: Courageous hit at least once → P = 0.2 * 0.36 = 0.072
    //     (1 hit: 0.2 * 0.32 = 0.064; 2 hits: 0.2 * 0.04 = 0.008 — but with
    //      only 1 attacker destroyer, both outcomes leave 0 destroyers,
    //      since Courageous's callback breaks early after first destroy.)
    const byAttackerRemaining: Record<number, number> = {}
    for (const b of chainBranches) {
      const count =
        unitsByBaseType(b.state.data.attacker).DESTROYER?.length ?? 0
      byAttackerRemaining[count] =
        (byAttackerRemaining[count] ?? 0) + b.probability
    }
    expect(byAttackerRemaining[1]).toBeCloseTo(0.128) // 0 Courageous hits
    expect(byAttackerRemaining[0]).toBeCloseTo(0.072) // 1 or 2 Courageous hits
  })

  it('5 cruisers vs 5 cruisers — full branch tree with 2-hit batch destruction', () => {
    // Attacker (Mentak): 5 cruisers (combat 7) with Ambush. Ambush picks
    // MAX_SHIPS=2 cruisers, rolls 2 dice at 7+:
    //   [0,0] P=0.36 → 0 hits → no destroy → no Courageous
    //   [0,1] P=0.24 → 1 hit  → 1 defender destroyed → Courageous fires
    //   [1,0] P=0.24 → 1 hit  → 1 defender destroyed → Courageous fires
    //   [1,1] P=0.16 → 2 hits → 2 defenders destroyed in one assignHits batch
    //                          → single runDestroyAbilities → Courageous fires
    //                          ONCE (uses=1)
    //
    // Courageous rolls 2d7 per firing (3 outcomes): 0 hits (0.36), 1 hit
    // (0.48), 2 hits (0.16). Each Courageous hit destroys one attacker cruiser
    // (plenty in stock — no early break).
    //
    // Total branches: 1 (no-fire) + 3 + 3 + 3 = 10.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 5 },
        abilities: { AMBUSH: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 5 },
        abilities: { COURAGEOUS_TO_THE_END: true },
      },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    expect(branches).toHaveLength(10)

    // Total probability = 1.
    const total = branches.reduce((a, b) => a + b.probability, 0)
    expect(total).toBeCloseTo(1)

    // Defender cruiser distribution: determined purely by Ambush outcome.
    //   5 → [0,0] only: 0.36
    //   4 → [0,1] + [1,0]: 0.48
    //   3 → [1,1]: 0.16
    const byDefender: Record<number, number> = {}
    for (const b of branches) {
      const count = unitsByBaseType(b.state.data.defender).CRUISER?.length ?? 0
      byDefender[count] = (byDefender[count] ?? 0) + b.probability
    }
    expect(byDefender[5]).toBeCloseTo(0.36)
    expect(byDefender[4]).toBeCloseTo(0.48)
    expect(byDefender[3]).toBeCloseTo(0.16)

    // Attacker cruiser distribution: 5 minus Courageous hits (when it fires).
    //   5 attackers → no Courageous hits in any branch that fired + the no-fire branch
    //     = 0.36 (no-fire) + (0.24+0.24+0.16) * 0.36 (Courageous 0-hits) = 0.5904
    //   4 attackers → Courageous produced exactly 1 hit across fired branches
    //     = (0.24+0.24+0.16) * 0.48 = 0.3072
    //   3 attackers → Courageous produced exactly 2 hits
    //     = (0.24+0.24+0.16) * 0.16 = 0.1024
    const byAttacker: Record<number, number> = {}
    for (const b of branches) {
      const count = unitsByBaseType(b.state.data.attacker).CRUISER?.length ?? 0
      byAttacker[count] = (byAttacker[count] ?? 0) + b.probability
    }
    expect(byAttacker[5]).toBeCloseTo(0.5904)
    expect(byAttacker[4]).toBeCloseTo(0.3072)
    expect(byAttacker[3]).toBeCloseTo(0.1024)

    // Cross-check: branches where defender took a hit (i.e. Courageous fired)
    // must split into exactly 3 sub-branches per Ambush outcome.
    const firedByDefenderCount = [4, 3].map(
      n =>
        branches.filter(
          b =>
            (unitsByBaseType(b.state.data.defender).CRUISER?.length ?? 0) === n,
        ).length,
    )
    // defender=4 came from two Ambush outcomes ([0,1] + [1,0]), each with
    // 3 Courageous sub-branches → 6 branches total.
    expect(firedByDefenderCount[0]).toBe(6)
    // defender=3 came from one Ambush outcome ([1,1]) with 3 Courageous
    // sub-branches → 3 branches.
    expect(firedByDefenderCount[1]).toBe(3)
  })
})
