import { CombatState } from '../combat-state/combat-state'
import {
  getInitialMetaPhase,
  getNextPhaseInFlow,
  isCombatMeta,
} from '../combat-state/phase-utils'
import type { CombatMode, MetaPhase } from '../combat-state/types'
import type { CombatOutcome } from '../types'
import { extractSurvivors } from './utils/extract-survivors'
import type { OutcomeRecord } from './utils/types'

interface ExpansionResult {
  outcomes: OutcomeRecord
  // Probability mass that should be absorbed by an ancestor as a self-loop
  // when that ancestor finalizes. Keys are the ancestors' cache keys.
  deferred: Map<string, number>
}

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
    // Cache: a node's result is `(outcomes, deferred)` where `deferred[k]`
    // is probability mass that flows back to ancestor key `k` via cycles.
    // The result is ONLY valid when all `deferred` keys are still in flight
    // — they will absorb the deferred mass via self-loop redistribution
    // when each of them finalizes. Cache hit = cached entry's `deferred`
    // keys are all currently in-progress.
    const subtreeCache = new Map<string, ExpansionResult>()
    const inProgress = new Set<string>()
    let counter = 1

    const mode = initialState.combatMode
    const initialMeta: MetaPhase = getInitialMetaPhase(mode)

    const expandNode = (
      state: CombatState,
      round: number,
      incomingMeta: MetaPhase,
    ): ExpansionResult | { cycleTo: string } => {
      let currentMeta = incomingMeta
      let cacheKey: string | null = null

      const enterCombatRound = ():
        | ExpansionResult
        | { cycleTo: string }
        | 'enter' => {
        round++
        const roundFlag = round <= 1 ? '1' : 'N'
        const key = `${roundFlag}|${state.getHash()}`

        // Cache hit only if all deferred-mass dependencies are still
        // in-progress (so they will absorb the deferred mass at their
        // finalization step). Otherwise the cached result would leak
        // probability into a context where no ancestor will resolve it.
        const cached = subtreeCache.get(key)
        if (cached) {
          let usable = true
          for (const dep of cached.deferred.keys()) {
            if (!inProgress.has(dep)) {
              usable = false
              break
            }
          }
          if (usable) {
            if (cacheKey) inProgress.delete(cacheKey)
            return cached
          }
        }

        if (inProgress.has(key)) {
          if (cacheKey) inProgress.delete(cacheKey)
          return { cycleTo: key }
        }

        if (cacheKey) inProgress.delete(cacheKey)
        cacheKey = key
        inProgress.add(key)
        return 'enter'
      }

      const finalize = (
        result: ExpansionResult | { cycleTo: string },
      ): ExpansionResult | { cycleTo: string } => {
        if (cacheKey !== null) {
          // Self-absorb deferred mass routed back to this very node.
          // Equivalent to expanding the geometric self-loop at this level.
          if ('outcomes' in result) {
            const selfMass = result.deferred.get(cacheKey)
            if (selfMass !== undefined && selfMass < 1) {
              const scale = 1 / (1 - selfMass)
              for (const o of result.outcomes.values()) o.probability *= scale
              result.deferred.delete(cacheKey)
              if (result.deferred.size > 0) {
                // Other deferred entries are downstream of this absorption
                // and must scale with the same factor (they ride the same
                // probability mass).
                for (const [k, p] of result.deferred) {
                  result.deferred.set(k, p * scale)
                }
              }
            } else if (selfMass !== undefined) {
              // selfMass >= 1 — pathological; treat as a pure cycle.
              result.deferred.delete(cacheKey)
            }
            subtreeCache.set(cacheKey, result)
          }
          inProgress.delete(cacheKey)
          cacheKey = null
        }
        return result
      }

      if (!state.isFinished() && state.pendingSteps.length === 0) {
        if (isCombatMeta(currentMeta)) {
          const res = enterCombatRound()
          if (res !== 'enter') return finalize(res)
        }
        state.loadPhaseScript(currentMeta, round)
      }

      while (true) {
        if (round > this.maxRounds) {
          console.warn(`Exceed ${this.maxRounds} rounds`)
        }
        if (state.isFinished() || round > this.maxRounds) {
          const leaf = makeLeafOutcome(state)
          return finalize({ outcomes: leaf, deferred: new Map() })
        }

        if (state.pendingSteps.length === 0) {
          const nextPhase = resolveNextPhase(currentMeta, mode)
          currentMeta = nextPhase
          if (state.isFinished()) continue
          if (isCombatMeta(nextPhase)) {
            const res = enterCombatRound()
            if (res !== 'enter') return finalize(res)
          }
          state.loadPhaseScript(nextPhase, round)
          if (state.pendingSteps.length === 0) continue
        }

        const outcomes = state.advance()

        counter += outcomes.length
        if (outcomes.length === 1 && outcomes[0].state === state) {
          continue
        }

        const merged: OutcomeRecord = new Map()
        const deferred = new Map<string, number>()

        for (const child of outcomes) {
          const r = expandNode(child.state, round, currentMeta)

          if ('cycleTo' in r) {
            deferred.set(
              r.cycleTo,
              (deferred.get(r.cycleTo) ?? 0) + child.probability,
            )
            continue
          }

          for (const [key, o] of r.outcomes) {
            const adjustedProb = o.probability * child.probability
            const existing = merged.get(key)
            if (existing) {
              existing.probability += adjustedProb
            } else {
              merged.set(key, {
                attackerData: o.attackerData,
                defenderData: o.defenderData,
                probability: adjustedProb,
                winnerSide: o.winnerSide,
              })
            }
          }

          for (const [k, p] of r.deferred) {
            deferred.set(k, (deferred.get(k) ?? 0) + p * child.probability)
          }
        }

        return finalize({ outcomes: merged, deferred })
      }
    }

    if (initialState.isFinished()) {
      return outcomeRecordToArray(makeLeafOutcome(initialState))
    }
    const result = expandNode(initialState, 0, initialMeta)
    if ('cycleTo' in result) return []
    console.log('Unique states =', subtreeCache.size)
    console.log('Unique nodes =', counter)
    return outcomeRecordToArray(result.outcomes)
  }
}

/** Decide the next meta-phase when the current script drains. Combat metas
 *  loop back to themselves; non-combat metas advance through the flow.
 *  Completion is owned entirely by combat-state — when it pushes the
 *  END_OF_COMBAT sequence, the outer loop sees `isFinished` flip on the
 *  next iteration. */
function resolveNextPhase(currentMeta: MetaPhase, mode: CombatMode): MetaPhase {
  if (isCombatMeta(currentMeta)) {
    return currentMeta
  }

  return getNextPhaseInFlow(currentMeta, mode) as MetaPhase
}

/** Build the leaf outcome for a finished (or maxRounds-aborted) state.
 *  `winnerSide` is normally set by `_triggerCompletion` before `_setComplete`
 *  flips `isFinished`. The maxRounds escape hatch is the one path that
 *  reaches here without a completion script having run, so fall back */
function makeLeafOutcome(state: CombatState): OutcomeRecord {
  const winnerSide = state.data.winnerSide ?? 'draw'
  const key = state.getUnitsHash()
  const record: OutcomeRecord = new Map()
  record.set(key, {
    attackerData: state.data.attacker,
    defenderData: state.data.defender,
    probability: 1,
    winnerSide,
  })
  return record
}

function outcomeRecordToArray(record: OutcomeRecord): CombatOutcome[] {
  const results: CombatOutcome[] = []
  for (const [, o] of record) {
    const attacker = extractSurvivors(o.attackerData)
    const defender = extractSurvivors(o.defenderData)

    results.push({
      attacker,
      defender,
      winner: o.winnerSide,
      probability: o.probability,
    })
  }
  return results
}
