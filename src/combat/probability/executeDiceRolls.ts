import type { DieValue } from '@/types'
import type { CombatSide, CombatState, ProbabilityNode } from '../types'
import { getCombinedDiceDistribution, type DiceRollOutcome } from '../dice'

/**
 * Branches a combat state into multiple tree nodes based on dice outcomes.
 * Returns nodes with empty children (to be filled by subsequent phases).
 */
function branchOnRoll(
  state: CombatState,
  distribution: DiceRollOutcome[],
  targetSide: CombatSide,
): ProbabilityNode[] {
  const nodes: ProbabilityNode[] = []

  for (const outcome of distribution) {
    if (outcome.probability === 0) continue

    const newState = structuredClone(state)
    newState[targetSide].pendingHits += outcome.hits

    nodes.push({
      state: newState,
      probability: outcome.probability,
      children: [],
      meta: {
        [targetSide]: outcome.hits,
      },
    })
  }

  return nodes
}

/**
 * Executes dice rolls for both sides and returns all possible outcome nodes.
 * Attacker hits go to defender's pending hits and vice versa.
 */
export function executeDiceRolls(
  state: CombatState,
  attackerDice: DieValue[],
  defenderDice: DieValue[],
): ProbabilityNode[] {
  const attackerDist = getCombinedDiceDistribution(attackerDice)
  const defenderDist = getCombinedDiceDistribution(defenderDice)

  // Branch on attacker's roll (hits go to defender), then defender's roll
  return branchOnRoll(state, attackerDist, 'defender').flatMap(attNode =>
    branchOnRoll(attNode.state, defenderDist, 'attacker').map(defNode => ({
      state: defNode.state,
      probability: attNode.probability * defNode.probability,
      children: [],
      meta: { ...attNode.meta, ...defNode.meta },
    })),
  )
}
