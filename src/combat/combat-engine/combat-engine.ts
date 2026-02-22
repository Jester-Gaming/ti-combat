import { CombatState } from '../combat-state/combat-state'
import type { CombatStateData } from '../combat-state/types'
import type { CombatOutcome, ProbabilityNode } from '../types'
import { determineWinner } from './utils/determine-winner'
import { extractSurvivors } from './utils/extract-survivors'
import { generateCompactOutcomeKey } from './utils/generate-compact-outcome-key'
import type { OutcomeRecord } from './utils/types'

interface EngineOptions {
  maxRounds?: number
  debug?: boolean
}

const DEFAULT_MAX_ROUNDS = 1000

function getNextRound(currentRound: number, data: CombatStateData): number {
  return data.currentPhase.micro === 'START' ? currentRound + 1 : currentRound
}

export class CombatEngine {
  private maxRounds: number
  private debug: boolean

  /** Available after simulate() when debug=true */
  lastTree: ProbabilityNode | null = null

  constructor(options: EngineOptions = {}) {
    this.maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS
    this.debug = options.debug ?? false
  }

  simulate(initialState: CombatState): CombatOutcome[] {
    this.lastTree = null

    const subtreeCache = new Map<string, OutcomeRecord>()
    const inProgress = new Set<string>()

    const debug = this.debug
    let nextNodeId = 0
    // Tree cache: maps START-phase cache key → children array.
    // Set at branch points BEFORE recursing, so cycle nodes can
    // point back to the same children array (preserving the DAG).
    const treeCache = debug ? new Map<string, ProbabilityNode[]>() : null

    const expandNode = (
      state: CombatState,
      round: number,
      node: ProbabilityNode | null,
    ): OutcomeRecord | null => {
      let cacheKey: string | null = null

      while (true) {
        if (round > this.maxRounds) {
          console.warn(`Exceed ${this.maxRounds} rounds`)
        }
        if (state.isFinished() || round > this.maxRounds) {
          const leaf = makeLeafOutcome(state)
          if (cacheKey) {
            subtreeCache.set(cacheKey, leaf)
            inProgress.delete(cacheKey)
          }
          return leaf
        }

        // Cache check at START of combat rounds
        if (state.currentPhase.micro === 'START') {
          const roundFlag = round <= 1 ? '1' : 'N'
          const key = `${roundFlag}|${state.getHash()}`

          const cached = subtreeCache.get(key)
          if (cached) {
            if (cacheKey) inProgress.delete(cacheKey)
            if (node && treeCache) {
              node.children = treeCache.get(key) ?? []
            }
            return cached
          }

          if (inProgress.has(key)) {
            if (cacheKey) inProgress.delete(cacheKey)
            if (node && treeCache) {
              node.children = treeCache.get(key) ?? []
            }
            return null // cycle
          }

          if (cacheKey) inProgress.delete(cacheKey)
          cacheKey = key
          inProgress.add(key)
        }

        const outcomes = state.advance(round, debug)

        // Deterministic advance — inline into loop
        if (outcomes.length === 1 && outcomes[0].probability === 1) {
          const outcome = outcomes[0]
          state = outcome.state
          round = getNextRound(round, outcome.state.data)
          if (node && state.log) {
            node.state = state
            node.round = round
            node.log = [...(node.log ?? []), ...state.log]
          }
          continue
        }

        // Branching — create tree children if debug, then recurse
        const children = node
          ? outcomes.map(o => ({
              id: nextNodeId++,
              state: o.state,
              probability: o.probability,
              round: getNextRound(round, o.state.data),
              children: [] as ProbabilityNode[],
              log: o.state.log ?? [],
            }))
          : null

        if (node && children) {
          node.children = children
          if (cacheKey && treeCache) {
            treeCache.set(cacheKey, children)
          }
        }

        // Group children by identical cached record (by reference) to avoid
        // redundant iteration. When multiple dice branches resolve to the same
        // cached state, we iterate the record once with summed probability
        // instead of N times.
        const recordGroups = new Map<OutcomeRecord, number>()
        let cycleProb = 0

        for (let i = 0; i < outcomes.length; i++) {
          const child = outcomes[i]
          const childRound = getNextRound(round, child.state.data)
          const childNode = children ? children[i] : null

          const childOutcomes = expandNode(child.state, childRound, childNode)

          if (childOutcomes === null) {
            cycleProb += child.probability
          } else {
            const existing = recordGroups.get(childOutcomes)
            if (existing !== undefined) {
              recordGroups.set(childOutcomes, existing + child.probability)
            } else {
              recordGroups.set(childOutcomes, child.probability)
            }
          }
        }

        // Fast path: single child record with no cycles — return directly
        if (recordGroups.size === 1 && cycleProb === 0) {
          const [[childRecord, totalProb]] = recordGroups
          let merged: OutcomeRecord
          if (totalProb === 1) {
            merged = childRecord
          } else {
            merged = new Map()
            for (const [key, outcome] of childRecord) {
              merged.set(key, {
                attackerData: outcome.attackerData,
                defenderData: outcome.defenderData,
                attackerParticipating: outcome.attackerParticipating,
                defenderParticipating: outcome.defenderParticipating,
                probability: outcome.probability * totalProb,
              })
            }
          }

          if (cacheKey) {
            subtreeCache.set(cacheKey, merged)
            inProgress.delete(cacheKey)
          }

          return merged
        }

        // Merge grouped records into final outcome
        const merged: OutcomeRecord = new Map()

        for (const [childRecord, totalProb] of recordGroups) {
          for (const [key, outcome] of childRecord) {
            const adjustedProb = outcome.probability * totalProb

            const existing = merged.get(key)
            if (existing) {
              existing.probability += adjustedProb
            } else {
              merged.set(key, {
                attackerData: outcome.attackerData,
                defenderData: outcome.defenderData,
                attackerParticipating: outcome.attackerParticipating,
                defenderParticipating: outcome.defenderParticipating,
                probability: adjustedProb,
              })
            }
          }
        }

        // Redistribute cycle probability
        if (cycleProb > 0 && cycleProb < 1) {
          const scale = 1 / (1 - cycleProb)
          for (const [, o] of merged) {
            o.probability *= scale
          }
        }

        if (cacheKey) {
          subtreeCache.set(cacheKey, merged)
          inProgress.delete(cacheKey)
        }

        return merged
      }
    }

    // Create root node for debug mode
    const root: ProbabilityNode | null = debug
      ? {
          id: nextNodeId++,
          state: initialState,
          probability: 1,
          round: 0,
          children: [],
          log: [],
        }
      : null

    let outcomes: OutcomeRecord | null
    if (initialState.isFinished()) {
      outcomes = makeLeafOutcome(initialState)
    } else {
      outcomes = expandNode(initialState, 0, root)
    }

    if (root) this.lastTree = root
    if (!outcomes) return []
    return outcomeRecordToArray(outcomes)
  }
}

function makeLeafOutcome(state: CombatState): OutcomeRecord {
  const attackerParticipating = state.side('attacker').getParticipatingUnits()
  const defenderParticipating = state.side('defender').getParticipatingUnits()
  const key = generateCompactOutcomeKey(
    state.data.attacker,
    state.data.defender,
    attackerParticipating,
    defenderParticipating,
  )
  const record: OutcomeRecord = new Map()
  record.set(key, {
    attackerData: state.data.attacker,
    defenderData: state.data.defender,
    attackerParticipating,
    defenderParticipating,
    probability: 1,
  })
  return record
}

function outcomeRecordToArray(record: OutcomeRecord): CombatOutcome[] {
  const results: CombatOutcome[] = []
  for (const [, o] of record) {
    results.push({
      attacker: extractSurvivors(o.attackerData, o.attackerParticipating),
      defender: extractSurvivors(o.defenderData, o.defenderParticipating),
      winner: determineWinner(o),
      probability: o.probability,
    })
  }
  return results
}
