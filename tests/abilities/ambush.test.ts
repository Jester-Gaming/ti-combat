import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('AMBUSH', () => {
  it('rolls 1 die for a single cruiser — 2 branches at 40%/60%', () => {
    // 1 cruiser (combat 7, 40% hit) → Ambush rolls 1 die.
    // Expected branches after START_OF_COMBAT:
    //   - 0 hits: prob 0.6 (defender destroyer alive)
    //   - 1 hit:  prob 0.4 (defender destroyer destroyed by inline assignHits)
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 1 },
        abilities: { AMBUSH: true },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 1 } },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    // Ambush split: exactly 2 outcomes
    expect(branches).toHaveLength(2)

    const probs = branches.map(b => b.probability).sort((a, b) => a - b)
    expect(probs[0]).toBeCloseTo(0.4)
    expect(probs[1]).toBeCloseTo(0.6)

    // The hit-branch should have destroyed the defender's destroyer via
    // the inline assignHits cascade after Ambush.
    const hitBranch = branches.find(b => b.probability < 0.5)!
    expect(hitBranch.state.data.defender.units.DESTROYER ?? []).toHaveLength(0)

    const missBranch = branches.find(b => b.probability > 0.5)!
    expect(missBranch.state.data.defender.units.DESTROYER).toHaveLength(1)
  })

  it('rolls up to 2 dice — 2 cruisers produce 4 Cartesian branches', () => {
    // 2 cruisers @ 7+: per-group outcomes [0,0],[0,1],[1,0],[1,1] with
    //   P([0,0]) = 0.36, P([0,1]) = 0.24, P([1,0]) = 0.24, P([1,1]) = 0.16
    // No branch merging happens in rollDice itself.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 2 },
        abilities: { AMBUSH: true },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 2 } },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    // 2 dice × 2 outcomes each = 4 Cartesian branches
    expect(branches).toHaveLength(4)

    // Group by remaining defender destroyer count (inline assignHits consumed
    // any produced hits). 0 hits → 2 destroyers; 1 hit → 1; 2 hits → 0.
    const byRemaining: Record<number, number> = {}
    for (const b of branches) {
      const count = b.state.data.defender.units.DESTROYER?.length ?? 0
      byRemaining[count] = (byRemaining[count] ?? 0) + b.probability
    }
    expect(byRemaining[2]).toBeCloseTo(0.36) // 0 hits
    expect(byRemaining[1]).toBeCloseTo(0.48) // 1 hit
    expect(byRemaining[0]).toBeCloseTo(0.16) // 2 hits
  })

  it('caps at 2 dice even with 3+ cruisers/destroyers', () => {
    // 3 cruisers present, but Ambush only rolls 2 dice.
    // Expected: 4 Cartesian branches (2 × 2), not 8.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { CRUISER: 3 },
        abilities: { AMBUSH: true },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 3 } },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    expect(branches).toHaveLength(4)
  })

  it('does not split when attacker has no cruisers or destroyers', () => {
    // Flagship + fighters only — Ambush should not fire, no branches.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { FLAGSHIP: 1, FIGHTER: 1 },
        abilities: { AMBUSH: true },
      },
      defender: { faction: 'ARBOREC', units: { FIGHTER: 1 } },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    // No roll → no split
    expect(branches).toHaveLength(1)
    expect(branches[0].probability).toBe(1)
  })

  it('rolls at combat value — destroyer at 9+ yields 20/80 split', () => {
    // 1 destroyer (combat 9, 20% hit) → branches at 0.2 / 0.8.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { DESTROYER: 1 },
        abilities: { AMBUSH: true },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 1 } },
    })

    t.advanceToTiming('START_OF_COMBAT')
    const branches = t.step()

    expect(branches).toHaveLength(2)
    const probs = branches.map(b => b.probability).sort((a, b) => a - b)
    expect(probs[0]).toBeCloseTo(0.2)
    expect(probs[1]).toBeCloseTo(0.8)
  })
})
