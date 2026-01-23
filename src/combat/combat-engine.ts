import { CombatState } from './state/combat-state'

/** A state with its probability and hit metadata */
interface StateWithProbability {
  state: CombatState
  probability: number
  meta?: { attacker: number; defender: number }
}

/** A node in the probability tree */
interface ProbabilityNode {
  state: CombatState
  probability: number
  children: ProbabilityNode[]
  meta?: Record<string, unknown>
}

interface EngineOptions {
  maxRounds?: number
}

const DEFAULT_MAX_ROUNDS = 100

/**
 * Combat simulation engine.
 *
 * Orchestrates CombatState through combat rounds without directly modifying state.
 * All state changes produce new immutable CombatState instances.
 *
 * Performance optimizations:
 * - Subtree caching: identical states share subtrees (DAG structure)
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
    initialState.abilities.runSetup(initialState)

    const root: ProbabilityNode = {
      state: initialState,
      probability: 1,
      children: [],
    }

    // Check for immediate end
    if (initialState.isFinished()) {
      return root
    }

    this.expandNode(root, 1)

    return root
  }

  private expandNode(node: ProbabilityNode, round: number): void {
    if (node.state.isFinished() || round > this.maxRounds) {
      return
    }

    const stateKey = node.state.getHash()
    const cached = this.subtreeCache.get(stateKey)
    if (cached) {
      node.children = cached
      return
    }

    node.children = this.simulateRound(node.state, round)
    this.subtreeCache.set(stateKey, node.children)

    for (const child of node.children) {
      this.expandNode(child, round + 1)
    }
  }

  private simulateRound(state: CombatState, round: number): ProbabilityNode[] {
    let nodes: StateWithProbability[] = [{ state, probability: 1 }]

    // AFB phase (round 1 only)
    if (round === 1) {
      nodes = this.expandPhase(nodes, s => {
        const attackerDice = s.collectDice('attacker', 'AFB')
        const defenderDice = s.collectDice('defender', 'AFB')
        return s.produceHits(attackerDice, defenderDice, 'AFB')
      })
      nodes = this.applyToAllNodes(nodes, s => s.assignHits())
    }

    // Combat phase
    nodes = this.expandPhase(nodes, s => {
      const attackerDice = s.collectDice('attacker', 'COMBAT')
      const defenderDice = s.collectDice('defender', 'COMBAT')
      return s.produceHits(attackerDice, defenderDice, 'COMBAT')
    })
    nodes = this.applyToAllNodes(nodes, s => s.assignHits())

    return nodes.map(n => ({
      state: n.state,
      probability: n.probability,
      children: [],
      meta: n.meta,
    }))
  }

  private expandPhase(
    nodes: StateWithProbability[],
    phase: (state: CombatState) => StateWithProbability[],
  ): StateWithProbability[] {
    return nodes.flatMap(node => {
      const children = phase(node.state)
      return children.map(child => ({
        state: child.state,
        probability: child.probability * node.probability,
        meta: child.meta,
      }))
    })
  }

  private applyToAllNodes(
    nodes: StateWithProbability[],
    transform: (state: CombatState) => CombatState,
  ): StateWithProbability[] {
    return nodes.map(node => ({
      ...node,
      state: transform(node.state),
    }))
  }
}
