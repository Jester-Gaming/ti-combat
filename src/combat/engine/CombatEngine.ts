import { produce } from 'immer'
import type { DieValue, UnitType, UnitStats } from '@/types'
import type { CombatSideState, ProbabilityNode, CombatState } from '../types'
import {
  CombatEventBus,
  type CombatEventName,
  type EventHandler,
} from '../events'
import { createInitialCombatState } from '../state/createInitialState'
import { checkCombatEnd } from '../state/checkCombatEnd'
import { destroyUnits } from '../hitAssignment'
import { executeDiceRolls, getStateHash } from '../probability'

export interface EngineOptions {
  /** Maximum number of combat rounds before forcing termination */
  maxRounds?: number
}

const DEFAULT_MAX_ROUNDS = 100

/**
 * Combat simulation engine.
 *
 * Core combat mechanics (dice rolls, hit assignment) are handled directly.
 * EventBus is used only for ability hooks at specific timing points.
 *
 * Performance optimizations:
 * - Subtree caching: identical states share subtrees (DAG structure)
 * - Probability pruning: branches below threshold are not expanded
 */
export class CombatEngine {
  private eventBus: CombatEventBus
  private maxRounds: number
  private subtreeCache: Map<string, ProbabilityNode[]>
  public realNodes: number = 0

  constructor(options: EngineOptions = {}) {
    this.eventBus = new CombatEventBus()
    this.maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS
    this.subtreeCache = new Map()
  }

  /**
   * Register an ability handler at a specific timing point.
   */
  on(event: CombatEventName, handler: EventHandler, priority?: number): void {
    this.eventBus.on(event, handler, priority)
  }

  /**
   * Unregister an ability handler.
   */
  off(event: CombatEventName, handler: EventHandler): void {
    this.eventBus.off(event, handler)
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
  ): ProbabilityNode {
    // Clear cache for new simulation
    this.subtreeCache.clear()

    const initialState = createInitialCombatState(
      attackerUnits,
      attackerCounts,
      defenderUnits,
      defenderCounts,
    )

    const root: ProbabilityNode = {
      state: initialState,
      probability: 1,
      children: [],
    }

    // Check for immediate end
    if (checkCombatEnd(initialState)) {
      return root // leaf node
    }

    this.expandNode(root, 1, 1)

    console.log(this.realNodes)

    return root
  }

  private expandNode(
    node: ProbabilityNode,
    round: number,
    cumulativeProbability: number,
  ): void {
    // Check combat end or max rounds
    if (checkCombatEnd(node.state) || round > this.maxRounds) {
      return // leaf node, children stays []
    }

    // Check cache for this state at this round
    const stateKey = getStateHash(node.state)
    const cached = this.subtreeCache.get(stateKey)
    if (cached) {
      node.children = cached
      return // Reuse existing subtree
    }

    // Get children from this round
    node.children = this.simulateRound(node.state, round)
    this.realNodes += node.children.length

    // Cache this subtree
    this.subtreeCache.set(stateKey, node.children)

    // Recursively expand each child
    for (const child of node.children) {
      this.expandNode(
        child,
        round + 1,
        cumulativeProbability * child.probability,
      )
    }
  }

  /**
   * Simulates a single round of combat.
   * Returns array of possible outcome nodes.
   */
  simulateRound(state: CombatState, round: number): ProbabilityNode[] {
    let nodes: ProbabilityNode[] = [{ state, probability: 1, children: [] }]

    // AFB phase (round 1 only)
    if (round === 1) {
      nodes = this.expandPhase(nodes, s => {
        const attackerDice = this.collectAfbDice(s.attacker)
        const defenderDice = this.collectAfbDice(s.defender)
        return executeDiceRolls(s, attackerDice, defenderDice)
      })
      nodes = this.applyToAllNodes(nodes, this.assignAfbHits.bind(this))
    }

    // Combat phase
    nodes = this.expandPhase(nodes, s => {
      const attackerDice = this.collectCombatDice(s.attacker)
      const defenderDice = this.collectCombatDice(s.defender)
      return executeDiceRolls(s, attackerDice, defenderDice)
    })
    nodes = this.applyToAllNodes(nodes, this.assignHits.bind(this))

    return nodes
  }

  private expandPhase(
    nodes: ProbabilityNode[],
    phase: (state: CombatState) => ProbabilityNode[],
  ): ProbabilityNode[] {
    return nodes.flatMap(node => {
      const children = phase(node.state)
      return children.map(child => ({
        ...child,
        probability: child.probability * node.probability,
      }))
    })
  }

  private applyToAllNodes(
    nodes: ProbabilityNode[],
    transform: (state: CombatState) => CombatState,
  ): ProbabilityNode[] {
    return nodes.map(node => ({
      ...node,
      state: transform(node.state),
    }))
  }

  private collectAfbDice(side: CombatSideState): DieValue[] {
    const diceByHitValue = new Map<number, number>()

    for (const [type, units] of Object.entries(side.units)) {
      if (!units || units.length === 0) continue

      const stats = side.stats[type as keyof typeof side.stats]
      const afb = stats?.ABILITIES?.AFB
      if (!afb) continue

      const [hitValue, dicePerUnit] = afb
      if (dicePerUnit <= 0) continue

      const totalDice = units.length * dicePerUnit
      const current = diceByHitValue.get(hitValue) ?? 0
      diceByHitValue.set(hitValue, current + totalDice)
    }

    const diceGroups: DieValue[] = []
    for (const [hitValue, count] of diceByHitValue) {
      diceGroups.push([hitValue, count])
    }

    return diceGroups
  }

  private collectCombatDice(side: CombatSideState): DieValue[] {
    const diceByHitValue = new Map<number, number>()

    for (const [type, units] of Object.entries(side.units)) {
      if (!units || units.length === 0) continue

      const stats = side.stats[type as keyof typeof side.stats]
      const combat = stats?.COMBAT
      if (!combat) continue

      const [hitValue, dicePerUnit] = combat
      if (dicePerUnit <= 0) continue

      const totalDice = units.length * dicePerUnit
      const current = diceByHitValue.get(hitValue) ?? 0
      diceByHitValue.set(hitValue, current + totalDice)
    }

    const diceGroups: DieValue[] = []
    for (const [hitValue, count] of diceByHitValue) {
      diceGroups.push([hitValue, count])
    }

    return diceGroups
  }

  private assignAfbHits(state: CombatState): CombatState {
    return produce(state, draft => {
      draft.attacker = destroyUnits(draft.attacker, ['FIGHTER'])
      draft.defender = destroyUnits(draft.defender, ['FIGHTER'])
    })
  }

  private assignHits(state: CombatState): CombatState {
    return produce(state, draft => {
      draft.attacker = destroyUnits(draft.attacker)
      draft.defender = destroyUnits(draft.defender)
    })
  }
}
