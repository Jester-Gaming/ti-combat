import { describe, expect, it } from 'vitest'

import type { FactionKey } from '@/types'

import { CombatState } from '../state/combat-state'
import type { SideState, Unit } from '../state/types'
import type { ProbabilityNode } from '../types'
import { flattenTree } from './flatten-tree'

const TEST_FACTION: FactionKey = 'ARBOREC'

describe('flattenTree', () => {
  const fighterStats: Partial<Unit> = { COMBAT: [9, 1], ABILITIES: {} }

  const createUnits = (count: number): Unit[] =>
    Array.from({ length: count }, () => ({ ...fighterStats }))

  const createSideState = (fighters: number): SideState => ({
    faction: TEST_FACTION,
    units: fighters > 0 ? { FIGHTER: createUnits(fighters) } : {},
    hitPools: [],
  })

  const makeState = (
    attackerFighters: number,
    defenderFighters: number,
  ): CombatState => {
    return new CombatState(
      createSideState(attackerFighters),
      createSideState(defenderFighters),
    )
  }

  it('returns single outcome for leaf node', () => {
    const root: ProbabilityNode = {
      state: makeState(1, 0),
      probability: 1,
      children: [],
    }

    const outcomes = flattenTree(root)

    expect(outcomes).toHaveLength(1)
    expect(outcomes[0].winner).toBe('attacker')
    expect(outcomes[0].probability).toBe(1)
  })

  it('accumulates probability through tree', () => {
    const root: ProbabilityNode = {
      state: makeState(1, 1),
      probability: 1,
      children: [
        {
          state: makeState(1, 0),
          probability: 0.6,
          children: [],
        },
        {
          state: makeState(0, 1),
          probability: 0.4,
          children: [],
        },
      ],
    }

    const outcomes = flattenTree(root)

    expect(outcomes).toHaveLength(2)
    const attackerWin = outcomes.find(o => o.winner === 'attacker')
    expect(attackerWin?.probability).toBeCloseTo(0.6)
  })

  it('merges identical outcomes', () => {
    const root: ProbabilityNode = {
      state: makeState(2, 1),
      probability: 1,
      children: [
        {
          state: makeState(1, 0),
          probability: 0.3,
          children: [],
        },
        {
          state: makeState(1, 0),
          probability: 0.2,
          children: [],
        },
      ],
    }

    const outcomes = flattenTree(root)

    expect(outcomes).toHaveLength(1)
    expect(outcomes[0].probability).toBeCloseTo(0.5)
  })

  it('handles cycles by redistributing probability (0-0 hits scenario)', () => {
    // Simulate: 30% chance both sides miss (cycle), 70% chance attacker wins
    // The 30% cycle probability should be redistributed to non-cycle outcomes
    // Expected: 70% / (1 - 30%) = 100%

    const sameState = makeState(1, 1)

    const leafWin: ProbabilityNode = {
      state: makeState(1, 0),
      probability: 0.7,
      children: [],
    }

    // Cycle node: when 0-0 hits happen, combat continues with same state
    // Its children are the SAME as root's children (shared reference = cycle)
    const cycleNode: ProbabilityNode = {
      state: sameState,
      probability: 0.3,
      children: [], // Will be set to root.children below
    }

    const root: ProbabilityNode = {
      state: sameState,
      probability: 1,
      children: [leafWin, cycleNode],
    }

    // Create the cycle: cycleNode's children point to root's children
    cycleNode.children = root.children

    const outcomes = flattenTree(root)

    expect(outcomes).toHaveLength(1)
    expect(outcomes[0].winner).toBe('attacker')
    // Probability redistributed: 0.7 + 0.3*(1/0.7)*0.7 = 0.7 + 0.3 = 1.0
    expect(outcomes[0].probability).toBeCloseTo(1.0)
  })

  it('redistributes cycle probability across multiple outcomes', () => {
    // User's example: 20% cycle, 20% outcome A, 60% outcome B
    // Expected: A = 25%, B = 75%

    const sameState = makeState(1, 1)

    const outcomeA: ProbabilityNode = {
      state: makeState(2, 0),
      probability: 0.2,
      children: [],
    }

    const outcomeB: ProbabilityNode = {
      state: makeState(1, 0),
      probability: 0.6,
      children: [],
    }

    const cycleNode: ProbabilityNode = {
      state: sameState,
      probability: 0.2,
      children: [], // Will create cycle
    }

    const root: ProbabilityNode = {
      state: sameState,
      probability: 1,
      children: [outcomeA, outcomeB, cycleNode],
    }

    cycleNode.children = root.children

    const outcomes = flattenTree(root)

    // Should have 2 distinct outcomes (different survivor counts)
    expect(outcomes).toHaveLength(2)

    const findOutcome = (fighters: number) =>
      outcomes.find(o => o.attacker['FIGHTER'] === fighters)

    // outcomeA: 2 fighters survive, expected 25%
    expect(findOutcome(2)?.probability).toBeCloseTo(0.25)
    // outcomeB: 1 fighter survives, expected 75%
    expect(findOutcome(1)?.probability).toBeCloseTo(0.75)
  })

  it('handles DAG correctly (shared node via different paths)', () => {
    // Diamond pattern: root -> [A, B] -> shared
    // Both paths should contribute probability to the shared node
    //
    //       root
    //      /    \
    //     A      B
    //      \    /
    //       shared (leaf)
    //
    // A has 40% prob, B has 60% prob
    // shared should get probability from BOTH paths: 0.4 + 0.6 = 1.0

    const shared: ProbabilityNode = {
      state: makeState(1, 0),
      probability: 1, // 100% once we reach A or B
      children: [],
    }

    const nodeA: ProbabilityNode = {
      state: makeState(1, 1),
      probability: 0.4,
      children: [shared], // Points to shared
    }

    const nodeB: ProbabilityNode = {
      state: makeState(1, 1),
      probability: 0.6,
      children: [shared], // Also points to shared (DAG!)
    }

    const root: ProbabilityNode = {
      state: makeState(2, 1),
      probability: 1,
      children: [nodeA, nodeB],
    }

    const outcomes = flattenTree(root)

    expect(outcomes).toHaveLength(1)
    expect(outcomes[0].winner).toBe('attacker')
    // Both paths contribute: 1 * 0.4 * 1 + 1 * 0.6 * 1 = 1.0
    expect(outcomes[0].probability).toBeCloseTo(1.0)
  })
})
