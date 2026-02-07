import { CombatState } from './combat-state/combat-state'
import type { ProbabilityNode } from './types'

interface EngineOptions {
  maxRounds?: number
}

const DEFAULT_MAX_ROUNDS = 100

function getNextRound(currentRound: number, state: CombatState): number {
  return state.currentPhase.micro === 'START' ? currentRound + 1 : currentRound
}

export class CombatEngine {
  private maxRounds: number
  private subtreeCache: Map<string, ProbabilityNode[]>
  private outcomes: number = 0
  private nextNodeId: number = 0

  constructor(options: EngineOptions = {}) {
    this.maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS
    this.subtreeCache = new Map()
  }

  simulate(initialState: CombatState): ProbabilityNode {
    this.outcomes = 0
    this.nextNodeId = 0
    this.subtreeCache.clear()

    const root: ProbabilityNode = {
      id: String(this.nextNodeId++),
      state: initialState,
      probability: 1,
      round: 0,
      children: [],
      log: [],
    }

    if (initialState.isFinished()) {
      return root
    }

    this.expandNode(root)
    return root
  }

  private expandNode(node: ProbabilityNode): void {
    let cacheKey: string | null = null

    while (true) {
      if (node.state.isFinished() || node.round > this.maxRounds) {
        this.outcomes++
        return
      }

      // Cache check: only at START of combat rounds
      if (node.state.currentPhase.micro === 'START') {
        const roundFlag = node.round <= 1 ? '1' : 'N'
        const key = `${roundFlag}|${node.state.getHash()}`
        const cached = this.subtreeCache.get(key)
        if (cached) {
          node.children = cached
          return
        }
        cacheKey = key
      }

      const outcomes = node.state.advance(node.round)

      if (outcomes.length === 1 && outcomes[0].probability === 1) {
        const outcome = outcomes[0]
        node.state = outcome.state
        node.round = getNextRound(node.round, outcome.state)
        if (outcome.log) {
          node.log = [...node.log, ...outcome.log]
        }
        continue
      }

      node.children = outcomes.map(outcome => ({
        id: String(this.nextNodeId++),
        state: outcome.state,
        probability: outcome.probability,
        round: getNextRound(node.round, outcome.state),
        children: [],
        log: outcome.log ?? [],
      }))

      if (cacheKey) {
        this.subtreeCache.set(cacheKey, node.children)
      }

      for (const child of node.children) {
        this.expandNode(child)
      }

      break
    }
  }
}
