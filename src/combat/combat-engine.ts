import { CombatState } from './state/combat-state'
import type { ProbabilityNode } from './types'

interface EngineOptions {
  maxRounds?: number
}

const DEFAULT_MAX_ROUNDS = 100

/**
 * Combat simulation engine.
 *
 * Orchestrates CombatState through combat phases without directly modifying state.
 * All state changes produce new immutable CombatState instances.
 *
 * Performance optimizations:
 * - Subtree caching: identical states share subtrees (DAG structure)
 * - Node collapsing: single deterministic outcomes update nodes in-place instead
 *   of creating child nodes, reducing tree depth
 */
export class CombatEngine {
  private maxRounds: number
  private subtreeCache: Map<string, ProbabilityNode[]>

  constructor(options: EngineOptions = {}) {
    this.maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS
    this.subtreeCache = new Map()
  }

  /**
   * Simulate combat and return a probability tree (DAG with shared subtrees).
   * Tree preserves full branching history without merging.
   */
  simulate(initialState: CombatState): ProbabilityNode {
    // Clear cache for new simulation
    this.subtreeCache.clear()

    // Run SETUP event for abilities (each ability called once)
    const stateAfterSetup = initialState.runSetup()

    const root: ProbabilityNode = {
      state: stateAfterSetup,
      probability: 1,
      round: 1,
      children: [],
    }

    // Check for immediate end
    if (stateAfterSetup.isFinished()) {
      return root
    }

    this.expandNode(root)

    return root
  }

  private expandNode(node: ProbabilityNode): void {
    // Loop to collapse deterministic single-outcome transitions
    while (true) {
      if (node.state.isFinished() || node.round > this.maxRounds) {
        return
      }

      // Cache key includes round for proper AFB handling and flatten-tree compatibility
      const stateKey = `${node.round}|${node.state.getHash()}`
      const cached = this.subtreeCache.get(stateKey)

      if (cached) {
        // Reuse cached subtree directly (creates DAG structure, prevents infinite loops)
        node.children = cached
        return
      }

      // Advance the state by one phase
      const outcomes = node.state.advance(node.round)

      // Optimization: if single deterministic outcome, collapse into current node
      if (outcomes.length === 1 && outcomes[0].probability === 1) {
        const outcome = outcomes[0]

        // Determine round for next iteration
        const nextRound =
          outcome.state.phase === 'START_OF_ROUND' &&
          node.state.phase === 'AFTER_ROUND'
            ? node.round + 1
            : node.round

        // Update node in place and continue loop
        node.state = outcome.state
        node.round = nextRound
        // Accumulate meta if present
        if (outcome.meta) {
          node.meta = { ...node.meta, ...outcome.meta }
        }
        // Continue loop to process next phase
        continue
      }

      // Multiple outcomes or probabilistic: create child nodes
      node.children = outcomes.map(outcome => {
        const childRound =
          outcome.state.phase === 'START_OF_ROUND' &&
          node.state.phase === 'AFTER_ROUND'
            ? node.round + 1
            : node.round

        return {
          state: outcome.state,
          probability: outcome.probability,
          round: childRound,
          children: [],
          meta: outcome.meta,
        }
      })

      // Cache the subtree before expansion
      this.subtreeCache.set(stateKey, node.children)

      // Recursively expand children
      for (const child of node.children) {
        this.expandNode(child)
      }

      // Exit loop after processing branching node
      break
    }
  }
}
