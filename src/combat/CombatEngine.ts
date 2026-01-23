import type { UnitType, UnitStats } from '@/types'
import type { ProbabilityNode } from './types'
import {
  CombatState,
  type CombatStateOptions,
  type StateWithProbability,
} from './state/CombatState'
import type { Ability } from './abilities'

export interface EngineOptions {
  /** Maximum number of combat rounds before forcing termination */
  maxRounds?: number
}

export interface SimulateOptions {
  attackerAbilities?: Ability[]
  defenderAbilities?: Ability[]
}

const DEFAULT_MAX_ROUNDS = 10

/**
 * Combat simulation engine.
 *
 * Core combat mechanics (dice rolls, hit assignment) are handled directly.
 * Abilities are resolved via AbilitiesTracker at specific timing points.
 *
 * Performance optimizations:
 * - Subtree caching: identical states share subtrees (DAG structure)
 * - Probability pruning: branches below threshold are not expanded
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
  simulate(
    attackerUnits: Partial<Record<UnitType, UnitStats>>,
    attackerCounts: Partial<Record<UnitType, number>>,
    defenderUnits: Partial<Record<UnitType, UnitStats>>,
    defenderCounts: Partial<Record<UnitType, number>>,
    options?: SimulateOptions,
  ): ProbabilityNode {
    // Clear cache for new simulation
    this.subtreeCache.clear()

    const stateOptions: CombatStateOptions = {
      abilities: {
        attacker: options?.attackerAbilities,
        defender: options?.defenderAbilities,
      },
    }

    const initialState = CombatState.create(
      attackerUnits,
      attackerCounts,
      defenderUnits,
      defenderCounts,
      stateOptions,
    )

    // Run SETUP event for abilities (each ability called once)
    initialState.abilities.runSetup(initialState)

    const root: ProbabilityNode = {
      state: initialState,
      probability: 1,
      children: [],
    }

    // Check for immediate end
    if (initialState.isFinished()) {
      return root // leaf node
    }

    this.expandNode(root, 1)

    return root
  }

  private expandNode(node: ProbabilityNode, round: number): void {
    // Check combat end or max rounds
    if (node.state.isFinished() || round > this.maxRounds) {
      return // leaf node, children stays []
    }

    // Check cache for this state at this round
    const stateKey = node.state.getHash()
    const cached = this.subtreeCache.get(stateKey)
    if (cached) {
      node.children = cached
      return // Reuse existing subtree
    }

    // Get children from this round
    node.children = this.simulateRound(node.state, round)

    // Cache this subtree
    this.subtreeCache.set(stateKey, node.children)

    // Recursively expand each child
    for (const child of node.children) {
      this.expandNode(child, round + 1)
    }
  }

  /**
   * Simulates a single round of combat.
   * Returns array of possible outcome nodes.
   */
  simulateRound(state: CombatState, round: number): ProbabilityNode[] {
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

    // Convert to ProbabilityNode format
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
