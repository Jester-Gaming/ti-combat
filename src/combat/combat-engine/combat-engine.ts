import { CombatState } from '../combat-state/combat-state'
import {
  getInitialMetaPhase,
  getNextPhaseInFlow,
  isCombatMeta,
} from '../combat-state/phase-utils'
import type {
  CombatMode,
  MetaPhase,
  PhaseTransitionTarget,
} from '../combat-state/types'
import type { CombatOutcome } from '../types'
import { determineWinner } from './utils/determine-winner'
import {
  extractSurvivors,
  mergeRetreatSurvivors,
} from './utils/extract-survivors'
import { generateCompactOutcomeKey } from './utils/generate-compact-outcome-key'
import type { OutcomeRecord } from './utils/types'

interface EngineOptions {
  maxRounds?: number
}

const DEFAULT_MAX_ROUNDS = 1000

export class CombatEngine {
  private maxRounds: number

  constructor(options: EngineOptions = {}) {
    this.maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS
  }

  simulate(initialState: CombatState): CombatOutcome[] {
    const subtreeCache = new Map<string, OutcomeRecord>()
    const inProgress = new Set<string>()

    const mode = initialState.combatMode

    // Engine owns the active meta — derived from the combat mode's initial
    // phase. Flow decisions read/write the local `currentMeta` inside
    // expandNode.
    const initialMeta: MetaPhase = getInitialMetaPhase(mode)

    const expandNode = (
      state: CombatState,
      round: number,
      incomingMeta: MetaPhase,
    ): OutcomeRecord | null => {
      let currentMeta = incomingMeta
      let cacheKey: string | null = null

      // Try to enter a combat-meta round: bump round, check the cache, and
      // either short-circuit on hit/cycle or register this as in-progress.
      // Returns `'enter'` when the caller should proceed with loading the
      // script, a cached outcome to return directly, or `null` for a cycle.
      const enterCombatRound = (): OutcomeRecord | null | 'enter' => {
        round++
        const roundFlag = round <= 1 ? '1' : 'N'
        const key = `${roundFlag}|${state.getHash()}`

        const cached = subtreeCache.get(key)
        if (cached) {
          if (cacheKey) inProgress.delete(cacheKey)
          return cached
        }

        if (inProgress.has(key)) {
          if (cacheKey) inProgress.delete(cacheKey)
          return null
        }

        if (cacheKey) inProgress.delete(cacheKey)
        cacheKey = key
        inProgress.add(key)
        return 'enter'
      }

      // Initial prime — if pendingSteps is empty on entry, the current
      // phase's script has not been loaded yet. Load it, doing the round/
      // cache bookkeeping if it's a combat meta.
      if (!state.isFinished() && state.pendingSteps.length === 0) {
        if (isCombatMeta(currentMeta)) {
          const res = enterCombatRound()
          if (res !== 'enter') return res
        }
        state.loadPhaseScript(currentMeta, round)
      }

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

        // Script just drained — transition to the next phase and reload.
        if (state.pendingSteps.length === 0) {
          const nextPhase = resolveNextPhase(state, currentMeta, mode)
          // Transitioning to COMPLETE still runs END_OF_COMBAT / CLEANUP_ROUND
          // / CLEANUP before flipping the phase — ability CLEANUP invokes
          // (e.g., CAVALRY removing its subtype) need to fire.
          if (nextPhase === 'COMPLETE') {
            state.loadCompletionSteps(currentMeta)
          } else {
            currentMeta = nextPhase
            if (state.isFinished()) continue
            if (isCombatMeta(nextPhase)) {
              const res = enterCombatRound()
              if (res !== 'enter') return res
            }
            state.loadPhaseScript(nextPhase, round)
          }
          // Empty script (unreachable after the branches above) — loop.
          if (state.pendingSteps.length === 0) continue
        }

        const outcomes = state.advance()

        // Deterministic advance — same state reference, same pendingSteps.
        // Advance ran internally until branching, drain, or completion.
        if (outcomes.length === 1 && outcomes[0].state === state) {
          continue
        }

        // Group children by identical cached record (by reference) to avoid
        // redundant iteration.
        const recordGroups = new Map<OutcomeRecord, number>()
        let cycleProb = 0

        for (const child of outcomes) {
          const childOutcomes = expandNode(child.state, round, currentMeta)

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
                abilities: outcome.abilities,
                probability: outcome.probability * totalProb,
                winnerOverride: outcome.winnerOverride,
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
                abilities: outcome.abilities,
                probability: adjustedProb,
                winnerOverride: outcome.winnerOverride,
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

    const outcomes = initialState.isFinished()
      ? makeLeafOutcome(initialState)
      : expandNode(initialState, 0, initialMeta)

    if (!outcomes) return []
    return outcomeRecordToArray(outcomes)
  }
}

/** Decide the next meta-phase when the current script drains. Combat metas
 *  loop back to themselves as long as no transition was forced; otherwise
 *  the flow advances. An ability-set `transitionTarget` overrides the flow. */
function resolveNextPhase(
  state: CombatState,
  currentMeta: MetaPhase,
  mode: CombatMode,
): PhaseTransitionTarget {
  const override = state.data.transitionTarget
  if (override) {
    delete state.data.transitionTarget
    return override
  }
  if (isCombatMeta(currentMeta)) {
    return currentMeta
  }
  return getNextPhaseInFlow(currentMeta, mode)
}

function makeLeafOutcome(state: CombatState): OutcomeRecord {
  const attackerParticipating = state.side('attacker').getParticipatingUnits()
  const defenderParticipating = state.side('defender').getParticipatingUnits()
  const winnerOverride = state.data.winnerOverride
  let key = generateCompactOutcomeKey(
    state.data.attacker,
    state.data.defender,
    attackerParticipating,
    defenderParticipating,
  )
  if (winnerOverride) key += `#${winnerOverride}`
  const record: OutcomeRecord = new Map()
  record.set(key, {
    attackerData: state.data.attacker,
    defenderData: state.data.defender,
    attackerParticipating,
    defenderParticipating,
    abilities: state.data.abilities,
    probability: 1,
    winnerOverride,
  })
  return record
}

function outcomeRecordToArray(record: OutcomeRecord): CombatOutcome[] {
  const results: CombatOutcome[] = []
  for (const [, o] of record) {
    // Determine winner BEFORE merging retreat-saved units
    const winner = determineWinner(o)
    const attacker = extractSurvivors(o.attackerData, o.attackerParticipating)
    const defender = extractSurvivors(o.defenderData, o.defenderParticipating)

    // Merge retreat-saved units into survivors (display only, doesn't affect winner)
    mergeRetreatSurvivors(attacker, o.abilities, 'attacker')
    mergeRetreatSurvivors(defender, o.abilities, 'defender')

    results.push({ attacker, defender, winner, probability: o.probability })
  }
  return results
}
