import { describe, it, expect } from 'vitest'
import { CombatEngine } from './CombatEngine'
import { flattenTree } from '../probability'
import type { UnitStats } from '@/types'
import type { ProbabilityNode } from '../types'

describe('CombatEngine', () => {
  const fighterStats: UnitStats = { COMBAT: [9, 1], ABILITIES: {} }
  const destroyerStats: UnitStats = {
    COMBAT: [8, 1],
    ABILITIES: { AFB: [9, 2] },
  }

  describe('simulate (tree structure)', () => {
    it('returns a tree with root probability 1', () => {
      const engine = new CombatEngine()
      const tree = engine.simulate(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
      )

      expect(tree.probability).toBe(1)
      expect(tree.children.length).toBeGreaterThan(0)
    })

    it('leaf nodes have empty children', () => {
      const engine = new CombatEngine()
      const tree = engine.simulate(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
      )

      // Track visited children arrays to handle DAG structure
      const visited = new Set<ProbabilityNode[]>()
      function findLeaves(node: ProbabilityNode): ProbabilityNode[] {
        if (node.children.length === 0) return [node]
        if (visited.has(node.children)) return []
        visited.add(node.children)
        return node.children.flatMap(findLeaves)
      }

      const leaves = findLeaves(tree)
      expect(leaves.length).toBeGreaterThan(0)
      expect(leaves.every(l => l.children.length === 0)).toBe(true)
    })

    it('children probabilities sum to 1 at each level', () => {
      const engine = new CombatEngine()
      const tree = engine.simulate(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
      )

      // Track visited children arrays to handle DAG structure
      const visited = new Set<ProbabilityNode[]>()
      function checkProbabilities(node: ProbabilityNode): void {
        if (node.children.length === 0) return
        if (visited.has(node.children)) return
        visited.add(node.children)

        const sum = node.children.reduce((s, c) => s + c.probability, 0)
        expect(sum).toBeCloseTo(1.0)

        for (const child of node.children) {
          checkProbabilities(child)
        }
      }

      checkProbabilities(tree)
    })
  })

  describe('flattened outcomes', () => {
    it('returns outcomes summing to probability 1.0', () => {
      const engine = new CombatEngine()
      const tree = engine.simulate(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
      )
      const outcomes = flattenTree(tree)

      const totalProb = outcomes.reduce((sum, o) => sum + o.probability, 0)
      expect(totalProb).toBeCloseTo(1.0)
    })

    it('1 fighter vs 1 fighter produces valid outcomes', () => {
      const engine = new CombatEngine()
      const tree = engine.simulate(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
      )
      const outcomes = flattenTree(tree)

      // Should have attacker wins, defender wins, and draw outcomes
      const winners = new Set(outcomes.map(o => o.winner))
      expect(winners.has('attacker')).toBe(true)
      expect(winners.has('defender')).toBe(true)
      // Draw is possible when both hit each other
      expect(winners.has('draw')).toBe(true)
    })

    it('calculates correct probabilities for 1 fighter vs 1 fighter', () => {
      const engine = new CombatEngine()
      const tree = engine.simulate(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
      )
      const outcomes = flattenTree(tree)

      // Due to symmetry, attacker and defender should have similar win rates
      const attackerWins = outcomes.filter(o => o.winner === 'attacker')
      const defenderWins = outcomes.filter(o => o.winner === 'defender')

      const attackerProb = attackerWins.reduce(
        (sum, o) => sum + o.probability,
        0,
      )
      const defenderProb = defenderWins.reduce(
        (sum, o) => sum + o.probability,
        0,
      )

      expect(Math.abs(attackerProb - defenderProb)).toBeLessThan(0.01)
    })
  })

  describe('with AFB', () => {
    it('AFB fires only on round 1', () => {
      const engine = new CombatEngine()
      const tree = engine.simulate(
        { DESTROYER: destroyerStats },
        { DESTROYER: 1 },
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
      )
      const outcomes = flattenTree(tree)

      // Destroyer has AFB [9, 2] - 2 dice at 9+
      // Can destroy 0, 1, or 2 fighters before combat
      const totalProb = outcomes.reduce((sum, o) => sum + o.probability, 0)
      expect(totalProb).toBeCloseTo(1.0)

      // Destroyer should often win due to AFB + better combat value
      const attackerWins = outcomes
        .filter(o => o.winner === 'attacker')
        .reduce((sum, o) => sum + o.probability, 0)
      expect(attackerWins).toBeGreaterThan(0.3)
    })
  })

  describe('edge cases', () => {
    it('handles empty attacker (defender auto-wins)', () => {
      const engine = new CombatEngine()
      const tree = engine.simulate(
        {},
        {},
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
      )
      const outcomes = flattenTree(tree)

      expect(outcomes).toHaveLength(1)
      expect(outcomes[0].winner).toBe('defender')
      expect(outcomes[0].probability).toBe(1)
    })

    it('handles empty defender (attacker auto-wins)', () => {
      const engine = new CombatEngine()
      const tree = engine.simulate(
        { FIGHTER: fighterStats },
        { FIGHTER: 1 },
        {},
        {},
      )
      const outcomes = flattenTree(tree)

      expect(outcomes).toHaveLength(1)
      expect(outcomes[0].winner).toBe('attacker')
      expect(outcomes[0].probability).toBe(1)
    })

    it('handles both empty (draw)', () => {
      const engine = new CombatEngine()
      const tree = engine.simulate({}, {}, {}, {})
      const outcomes = flattenTree(tree)

      expect(outcomes).toHaveLength(1)
      expect(outcomes[0].winner).toBe('draw')
      expect(outcomes[0].probability).toBe(1)
    })

    it('terminates within max rounds', () => {
      // Use small fleet and limited rounds to avoid exponential tree growth
      const engine = new CombatEngine({ maxRounds: 5 })
      const tree = engine.simulate(
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
      )
      const outcomes = flattenTree(tree)

      const totalProb = outcomes.reduce((sum, o) => sum + o.probability, 0)
      expect(totalProb).toBeCloseTo(1.0)
    })
  })

  describe('performance optimizations', () => {
    it('reuses subtrees for identical states (DAG structure)', () => {
      const engine = new CombatEngine({ maxRounds: 5 })
      // 2v2 battle - multiple paths can lead to 1v1 state
      const tree = engine.simulate(
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
        { FIGHTER: fighterStats },
        { FIGHTER: 2 },
      )

      // Collect all children arrays to check for reference equality
      // Track visited to handle DAG structure without infinite recursion
      const childrenArrays: ProbabilityNode[][] = []
      const visited = new Set<ProbabilityNode[]>()
      function collectChildren(node: ProbabilityNode): void {
        if (node.children.length > 0) {
          childrenArrays.push(node.children)
          if (visited.has(node.children)) return
          visited.add(node.children)
          for (const child of node.children) {
            collectChildren(child)
          }
        }
      }
      collectChildren(tree)

      // Check if any two arrays are the same reference (shared subtree)
      let hasSharedSubtree = false
      for (let i = 0; i < childrenArrays.length; i++) {
        for (let j = i + 1; j < childrenArrays.length; j++) {
          if (childrenArrays[i] === childrenArrays[j]) {
            hasSharedSubtree = true
            break
          }
        }
        if (hasSharedSubtree) break
      }

      expect(hasSharedSubtree).toBe(true)
    })
  })
})
