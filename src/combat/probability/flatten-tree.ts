import type { UnitType } from '@/types'

import { countUnits } from '../state/side-state-ops'
import type {
  CombatOutcome,
  CombatSide,
  ProbabilityNode,
  SurvivorSide,
} from '../types'

/** Outcome with probability relative to reaching the node */
interface RelativeOutcome {
  attacker: SurvivorSide
  defender: SurvivorSide
  winner: CombatSide | 'draw'
  probability: number
}

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
  // Cache: nodeId -> Map<outcomeKey, RelativeOutcome>
  // Stores already-computed outcomes with relative probabilities
  const cache = new Map<string, Map<string, RelativeOutcome>>()

  // Track nodes currently being processed (for cycle detection)
  const processing = new Set<string>()

  /**
   * Process a node and return its outcomes with relative probabilities.
   * Returns empty Map if this node is a cycle (caller will redistribute).
   */
  function processNode(node: ProbabilityNode): Map<string, RelativeOutcome> {
    // CYCLE DETECTION: If we're already processing this node, it's a cycle
    if (processing.has(node.id)) {
      return new Map()
    }

    // CACHE HIT: Return cached outcomes (DAG optimization)
    const cached = cache.get(node.id)
    if (cached !== undefined) {
      return cached
    }

    // LEAF NODE: Extract final outcome
    if (node.children.length === 0) {
      const outcome = extractLeafOutcome(node)
      const key = generateOutcomeKey(outcome.attacker, outcome.defender)
      const result = new Map<string, RelativeOutcome>([
        [key, { ...outcome, probability: 1 }],
      ])
      cache.set(node.id, result)
      return result
    }

    // BRANCH NODE: Process children and merge outcomes
    processing.add(node.id)

    // Calculate total cycle probability among immediate children
    let cycleProb = 0
    for (const child of node.children) {
      if (processing.has(child.id)) {
        cycleProb += child.probability
      }
    }

    // Scale factor for geometric series: 1 / (1 - p)
    // Special case: if cycleProb >= 1, use scale factor of 1 (no scaling)
    const scaleFactor = cycleProb < 1 ? 1 / (1 - cycleProb) : 1

    // Collect and merge outcomes from children
    const merged = new Map<string, RelativeOutcome>()

    for (const child of node.children) {
      // Process child if:
      // - It's not a cycle, OR
      // - It's the only child (even if it cycles)
      // This matches the original algorithm's logic
      const shouldProcess =
        !processing.has(child.id) || node.children.length === 1

      if (!shouldProcess) {
        continue
      }

      const childOutcomes = processNode(child)

      // Merge child outcomes into our map
      for (const [key, outcome] of childOutcomes) {
        // Scale by child probability and cycle adjustment
        const adjustedProb =
          outcome.probability * child.probability * scaleFactor

        const existing = merged.get(key)
        if (existing) {
          // Merge with existing outcome
          existing.probability += adjustedProb
        } else {
          // Add new outcome
          merged.set(key, {
            attacker: outcome.attacker,
            defender: outcome.defender,
            winner: outcome.winner,
            probability: adjustedProb,
          })
        }
      }
    }

    processing.delete(node.id)

    // Cache the merged outcomes
    cache.set(node.id, merged)
    return merged
  }

  // Process tree starting from root
  const relativeOutcomes = processNode(root)

  // Convert to final array format (apply root probability)
  const results: CombatOutcome[] = []
  for (const outcome of relativeOutcomes.values()) {
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
    node.state.attacker.units,
    attackerParticipating,
  )
  const defenderSurvivors = extractSurvivors(
    node.state.defender.units,
    defenderParticipating,
  )

  const attackerParticipatingCount = countSurvivors(attackerSurvivors)
  const defenderParticipatingCount = countSurvivors(defenderSurvivors)

  // Also count total units (for bombardment/space cannon scenarios)
  const attackerTotalCount = countUnits(node.state.attacker)
  const defenderTotalCount = countUnits(node.state.defender)

  return {
    attacker: attackerSurvivors,
    defender: defenderSurvivors,
    winner: determineWinner(
      attackerParticipatingCount,
      defenderParticipatingCount,
      attackerTotalCount,
      defenderTotalCount,
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
  const formatSide = (side: SurvivorSide): string =>
    Object.entries(side)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([type, count]) => `${type}:${count}`)
      .join(',')

  return `${formatSide(attacker)}|${formatSide(defender)}`
}

/**
 * Extract survivors from units, filtering by participating units.
 */
function extractSurvivors(
  units: Partial<Record<string, unknown[]>>,
  participatingUnits: ReadonlySet<UnitType>,
): SurvivorSide {
  const survivors: SurvivorSide = {}
  for (const unitType in units) {
    if (!participatingUnits.has(unitType as UnitType)) continue
    const unitList = units[unitType]
    if (unitList && unitList.length > 0) {
      survivors[unitType] = unitList.length
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
  totalA: number,
  totalD: number,
): CombatSide | 'draw' {
  if (participatingA > 0 && participatingD === 0) return 'attacker'
  if (participatingD > 0 && participatingA === 0) return 'defender'

  // Neither side has participating units - fall back to total counts
  if (participatingA === 0 && participatingD === 0) {
    if (totalA > 0 && totalD === 0) return 'attacker'
    if (totalD > 0 && totalA === 0) return 'defender'
  }

  return 'draw'
}

/**
 * Count total survivors across all unit types.
 */
function countSurvivors(survivors: SurvivorSide): number {
  return Object.values(survivors).reduce((sum, count) => sum + count, 0)
}
