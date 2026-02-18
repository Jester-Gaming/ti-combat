import type { CombatSide, UnitType } from '@/types'

import type { CombatOutcome, ProbabilityNode, SurvivorSide } from '../types'
import { parseVariantId } from '../utils/unit-variant'

/** Outcome with probability relative to reaching the node */
interface RelativeOutcome {
  attacker: SurvivorSide
  defender: SurvivorSide
  winner: CombatSide | 'draw'
  probability: number
}

type OutcomeRecord = Record<string, RelativeOutcome>

/** Sentinel for cycle detection — distinguishable from undefined (not yet cached) */
const EMPTY_OUTCOMES: OutcomeRecord = Object.freeze({})

/**
 * Flattens a probability tree (DAG with cycles) into combat outcomes.
 *
 * Algorithm:
 * 1. Memoization: Cache processed nodes to handle DAG structure (shared subtrees)
 * 2. Cycle detection: Track current processing path with Set
 * 3. Cycle resolution: Apply geometric series formula: final = prob / (1 - cycleProb)
 * 4. Outcome merging: Merge identical outcomes at each level to prevent explosion
 *
 * Performance: O(N) where N = unique nodes (each processed once)
 *
 * Handles:
 * - DAG structure: Same node reachable via multiple paths
 * - Direct cycles: node -> ... -> node
 * - Complex cycles: Multiple paths with cycles at different depths
 */
export function flattenTree(root: ProbabilityNode): CombatOutcome[] {
  // Cache: nodeId -> outcomes (array indexed by numeric id)
  // Stores already-computed outcomes with relative probabilities
  const cache: (OutcomeRecord | undefined)[] = []

  // Track nodes currently being processed (for cycle detection)
  const processing: boolean[] = []

  // Cache merge results by children-array reference. When the engine
  // cache hits, multiple branch nodes share the exact same children
  // array object. Their merge results are identical (same children
  // with same probabilities), so we can skip re-merging ~99% of
  // branch nodes. Only valid when cycleProb === 0.
  const childrenMergeCache = new Map<ProbabilityNode[], OutcomeRecord>()

  /**
   * Process a node and return its outcomes with relative probabilities.
   * Returns EMPTY_OUTCOMES if this node is a cycle (caller will redistribute).
   */
  function processNode(node: ProbabilityNode): OutcomeRecord {
    // CYCLE DETECTION: If we're already processing this node, it's a cycle
    if (processing[node.id]) {
      return EMPTY_OUTCOMES
    }

    // CACHE HIT: Return cached outcomes (DAG optimization)
    const cached = cache[node.id]
    if (cached !== undefined) {
      return cached
    }

    // LEAF NODE: Extract final outcome
    if (node.children.length === 0) {
      const outcome = extractLeafOutcome(node)
      const key = generateOutcomeKey(outcome.attacker, outcome.defender)
      const result: OutcomeRecord = {
        [key]: { ...outcome, probability: 1 },
      }
      cache[node.id] = result
      return result
    }

    // BRANCH NODE: Process children and merge outcomes
    processing[node.id] = true

    // Calculate total cycle probability among immediate children
    let cycleProb = 0
    for (const child of node.children) {
      if (processing[child.id]) {
        cycleProb += child.probability
      }
    }

    // When no cycles, check if we've already merged this exact
    // children array (shared via engine subtree cache)
    if (cycleProb === 0) {
      const cachedMerge = childrenMergeCache.get(node.children)
      if (cachedMerge) {
        processing[node.id] = false
        cache[node.id] = cachedMerge
        return cachedMerge
      }
    }

    // Scale factor for geometric series: 1 / (1 - p)
    // Special case: if cycleProb >= 1, use scale factor of 1 (no scaling)
    const scaleFactor = cycleProb < 1 ? 1 / (1 - cycleProb) : 1

    // Collect and merge outcomes from children
    const merged: OutcomeRecord = {}

    for (const child of node.children) {
      // Process child if:
      // - It's not a cycle, OR
      // - It's the only child (even if it cycles)
      // This matches the original algorithm's logic
      const shouldProcess = !processing[child.id] || node.children.length === 1

      if (!shouldProcess) {
        continue
      }

      const childOutcomes = processNode(child)

      // Merge child outcomes into our record
      for (const key in childOutcomes) {
        const outcome = childOutcomes[key]
        // Scale by child probability and cycle adjustment
        const adjustedProb =
          outcome.probability * child.probability * scaleFactor

        const existing = merged[key]
        if (existing) {
          // Merge with existing outcome
          existing.probability += adjustedProb
        } else {
          // Add new outcome
          merged[key] = {
            attacker: outcome.attacker,
            defender: outcome.defender,
            winner: outcome.winner,
            probability: adjustedProb,
          }
        }
      }
    }

    processing[node.id] = false

    // Cache by children-array reference when no cycles
    if (cycleProb === 0) {
      childrenMergeCache.set(node.children, merged)
    }

    // Cache the merged outcomes
    cache[node.id] = merged
    return merged
  }

  // Process tree starting from root
  const relativeOutcomes = processNode(root)

  // Convert to final array format (apply root probability)
  const results: CombatOutcome[] = []
  for (const key in relativeOutcomes) {
    const outcome = relativeOutcomes[key]
    const finalProb = outcome.probability * root.probability
    results.push({
      attacker: outcome.attacker,
      defender: outcome.defender,
      winner: outcome.winner,
      probability: finalProb,
    })
  }

  return results
}

/**
 * Extract outcome from a leaf node.
 *
 * Winner determination considers both participating units and total units:
 * - If defender has 0 participating units and attacker has any units, attacker wins
 *   (this covers bombardment scenarios where ships eliminate all ground forces)
 * - If attacker has 0 participating units and defender has any units, defender wins
 * - If both have 0 participating units, check total units for the winner
 */
function extractLeafOutcome(
  node: ProbabilityNode,
): Omit<RelativeOutcome, 'probability'> {
  const attackerParticipating = node.state.getParticipatingUnits('attacker')
  const defenderParticipating = node.state.getParticipatingUnits('defender')

  const attackerSurvivors = extractSurvivors(
    node.state.data.attacker,
    attackerParticipating,
  )
  const defenderSurvivors = extractSurvivors(
    node.state.data.defender,
    defenderParticipating,
  )

  const attackerParticipatingCount = countSurvivors(attackerSurvivors)
  const defenderParticipatingCount = countSurvivors(defenderSurvivors)

  return {
    attacker: attackerSurvivors,
    defender: defenderSurvivors,
    winner: determineWinner(
      attackerParticipatingCount,
      defenderParticipatingCount,
    ),
  }
}

/**
 * Generate a unique key for an outcome based on survivors.
 */
function generateOutcomeKey(
  attacker: SurvivorSide,
  defender: SurvivorSide,
): string {
  return `${formatSideKey(attacker)}|${formatSideKey(defender)}`
}

function formatSideKey(side: SurvivorSide): string {
  const keys = Object.keys(side)
  if (keys.length === 0) return ''
  if (keys.length > 1) keys.sort()

  let result = ''
  for (const type of keys) {
    const units = side[type]
    if (!units || units.length === 0) continue

    if (result) result += ','
    result += type + ':' + units.length

    // Count damaged units without allocating a filtered array
    let damaged = 0
    let hasSubtypes = false
    for (const u of units) {
      if (u.isDamaged) damaged++
      if (u.subtypes?.length) hasSubtypes = true
    }
    if (damaged) result += 'd' + damaged
    if (hasSubtypes) {
      const allSubtypes: string[] = []
      for (const u of units) {
        if (u.subtypes) {
          for (const s of u.subtypes) allSubtypes.push(s)
        }
      }
      allSubtypes.sort()
      result += 's' + allSubtypes.join('+')
    }
  }
  return result
}

/**
 * Extract survivors from compact state, filtering by participating units.
 */
function extractSurvivors(
  sideState: {
    units: Record<string, number>
    unitState: Record<string, import('@/types').UnitState[]>
  },
  participatingUnits: ReadonlySet<UnitType>,
): SurvivorSide {
  const survivors: SurvivorSide = {}

  for (const key of Object.keys(sideState.units)) {
    const count = sideState.units[key]
    if (count <= 0) continue

    const { type, subtypes } = parseVariantId(key)
    if (!participatingUnits.has(type)) continue

    if (!survivors[type]) {
      survivors[type] = []
    }

    const stateArr = sideState.unitState[key]
    for (let i = 0; i < count; i++) {
      const us = stateArr?.[i]
      survivors[type]!.push({
        ...(us?.isDamaged ? { isDamaged: true } : {}),
        ...(subtypes.length > 0 ? { subtypes } : {}),
      })
    }
  }

  return survivors
}

/**
 * Determine the winner based on surviving unit counts.
 * Checks participating units first, falls back to total units for
 * bombardment scenarios where ships eliminate all ground forces.
 */
function determineWinner(
  participatingA: number,
  participatingD: number,
): CombatSide | 'draw' {
  if (participatingA > 0 && participatingD === 0) return 'attacker'
  if (participatingD > 0 && participatingA === 0) return 'defender'

  return 'draw'
}

/**
 * Count total survivors across all unit types.
 */
function countSurvivors(survivors: SurvivorSide): number {
  return Object.values(survivors).reduce(
    (sum, units) => sum + (units?.length ?? 0),
    0,
  )
}
