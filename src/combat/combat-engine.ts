import { CombatState } from './combat-state/combat-state'
import { getPhaseKey } from './combat-state/phase-utils'
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
function getNextRound(currentRound: number, state: CombatState): number {
  return state.currentPhase.micro === 'START' ? currentRound + 1 : currentRound
}

export class CombatEngine {
  private maxRounds: number
  private subtreeCache: Map<string, ProbabilityNode[]>
  private outcomes: number = 0

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
    this.outcomes = 0
    this.subtreeCache.clear()

    const root: ProbabilityNode = {
      id: crypto.randomUUID(),
      state: initialState,
      probability: 1,
      round: 0,
      children: [],
      log: [],
    }

    // Check for immediate end
    if (initialState.isFinished()) {
      return root
    }

    this.expandNode(root)
    // console.info('Total', this.outcomes)
    // console.info('Cache length', this.subtreeCache.size)

    return root
  }

  private expandNode(node: ProbabilityNode): void {
    // Loop to collapse deterministic single-outcome transitions
    while (true) {
      if (node.state.isFinished() || node.round > this.maxRounds) {
        this.outcomes++
        return
      }

      // Cache key includes phase for correctness (states at different phases must not collide)
      // and round-1 flag for AFB handling and flatten-tree compatibility
      const { meta, micro } = node.state.currentPhase
      const isEarlyPhase =
        node.round === 1 &&
        (micro === 'START' || micro === 'ASSIGN_HITS' || meta === 'AFB')
      const roundKey = isEarlyPhase ? 'EARLY' : 'NORMAL'
      const phaseKey = getPhaseKey(node.state.currentPhase)
      const stateKey = `${phaseKey}|${roundKey}|${node.state.getHash()}`
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

        node.state = outcome.state
        node.round = getNextRound(node.round, outcome.state)

        if (outcome.log) {
          node.log = [...node.log, ...outcome.log]
        }

        continue
      }

      // Multiple outcomes or probabilistic: create child nodes
      node.children = outcomes.map(outcome => ({
        id: crypto.randomUUID(),
        state: outcome.state,
        probability: outcome.probability,
        round: getNextRound(node.round, outcome.state),
        children: [],
        log: outcome.log ?? [],
      }))

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
