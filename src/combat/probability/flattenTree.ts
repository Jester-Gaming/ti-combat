import type {
  ProbabilityNode,
  CombatOutcome,
  CombatSide,
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
 * Optimizations:
 * - WeakSet for O(1) cycle detection
 * - Cache stores pre-merged Map<key, outcome> instead of array
 * - Merges outcomes at each node level (prevents combinatorial explosion)
 * - Inline hot path functions
 *
 * Handles:
 * 1. Direct cycles (node -> ... -> node)
 * 2. Indirect cycles (node -> A -> B -> node)
 * 3. DAG structure (same node via different paths)
 */
export function flattenTree(root: ProbabilityNode): CombatOutcome[] {
  // Cache stores already-merged outcomes for each node (key -> outcome)
  const cache = new Map<ProbabilityNode, Map<string, RelativeOutcome>>()
  // Track current path for cycle detection (WeakSet for O(1) lookup)
  const inPath = new WeakSet<ProbabilityNode>()

  // Inline key generation for outcome merging
  function generateKey(attacker: SurvivorSide, defender: SurvivorSide): string {
    const attackerEntries = Object.entries(attacker)
    const defenderEntries = Object.entries(defender)
    attackerEntries.sort((a, b) => a[0].localeCompare(b[0]))
    defenderEntries.sort((a, b) => a[0].localeCompare(b[0]))

    let key = ''
    for (let j = 0; j < attackerEntries.length; j++) {
      if (j > 0) key += ','
      key += attackerEntries[j][0] + ':' + attackerEntries[j][1]
    }
    key += '|'
    for (let j = 0; j < defenderEntries.length; j++) {
      if (j > 0) key += ','
      key += defenderEntries[j][0] + ':' + defenderEntries[j][1]
    }
    return key
  }

  function processNode(node: ProbabilityNode): Map<string, RelativeOutcome> {
    // Cycle detected - return empty (parent will redistribute)
    if (inPath.has(node)) {
      return new Map()
    }

    // Cache hit - reuse computed outcomes (already merged)
    const cached = cache.get(node)
    if (cached !== undefined) {
      return cached
    }

    // Leaf node - inline survivor extraction for performance
    if (node.children.length === 0) {
      const attackerSurvivors: SurvivorSide = {}
      const defenderSurvivors: SurvivorSide = {}
      let attackerCount = 0
      let defenderCount = 0

      for (const unitType in node.state.attacker.units) {
        const units =
          node.state.attacker.units[
            unitType as keyof typeof node.state.attacker.units
          ]
        if (units && units.length > 0) {
          attackerSurvivors[unitType] = units.length
          attackerCount += units.length
        }
      }

      for (const unitType in node.state.defender.units) {
        const units =
          node.state.defender.units[
            unitType as keyof typeof node.state.defender.units
          ]
        if (units && units.length > 0) {
          defenderSurvivors[unitType] = units.length
          defenderCount += units.length
        }
      }

      const winner: CombatSide | 'draw' =
        attackerCount > 0 ? 'attacker' : defenderCount > 0 ? 'defender' : 'draw'

      const key = generateKey(attackerSurvivors, defenderSurvivors)
      const result = new Map<string, RelativeOutcome>()
      result.set(key, {
        attacker: attackerSurvivors,
        defender: defenderSurvivors,
        winner,
        probability: 1,
      })
      cache.set(node, result)
      return result
    }

    // Mark node as being processed
    inPath.add(node)

    // Calculate cycle probability among immediate children
    let cycleProb = 0
    const children = node.children
    const childCount = children.length

    for (let i = 0; i < childCount; i++) {
      if (inPath.has(children[i])) {
        cycleProb += children[i].probability
      }
    }

    // Scale factor to redistribute cycle probability
    const scaleFactor = cycleProb < 1 ? 1 / (1 - cycleProb) : 1

    // Collect and merge outcomes from non-cycle children
    const outcomes = new Map<string, RelativeOutcome>()

    for (let i = 0; i < childCount; i++) {
      const child = children[i]
      if (!inPath.has(child)) {
        const childOutcomes = processNode(child)
        const childScale = child.probability * scaleFactor

        // Merge child outcomes into our map (aggregate immediately)
        for (const [key, outcome] of childOutcomes) {
          const scaledProb = outcome.probability * childScale
          const existing = outcomes.get(key)
          if (existing) {
            existing.probability += scaledProb
          } else {
            outcomes.set(key, {
              attacker: outcome.attacker,
              defender: outcome.defender,
              winner: outcome.winner,
              probability: scaledProb,
            })
          }
        }
      }
    }

    // Remove from path
    inPath.delete(node)

    // Cache and return (already merged)
    cache.set(node, outcomes)
    return outcomes
  }

  // Process tree - returns already-merged map
  const relativeOutcomes = processNode(root)
  const rootProb = root.probability

  // Convert to final array format (apply root probability)
  const results: CombatOutcome[] = []
  for (const outcome of relativeOutcomes.values()) {
    results.push({
      attacker: outcome.attacker,
      defender: outcome.defender,
      winner: outcome.winner,
      probability: outcome.probability * rootProb,
    })
  }

  return results
}
