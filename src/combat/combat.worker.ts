import type { FactionKey, UnitSelection, UnitType } from '@/types'
import { getSimulationUnits } from '@/utils/get-simulation-units'

import { CombatEngine } from './combat-engine'
import { CombatState } from './combat-state/combat-state'
import type {
  AbilitiesConfig,
  CombatMode,
  SideStateData,
} from './combat-state/types'
import { flattenTree } from './probability/flatten-tree'
import type { ProbabilityNode } from './types'

export interface SimulationInput {
  attackerFaction: FactionKey
  defenderFaction: FactionKey
  attackerSelections: Record<UnitType, UnitSelection>
  defenderSelections: Record<UnitType, UnitSelection>
  combatMode: CombatMode
  abilities: AbilitiesConfig
}

function buildSideState(
  faction: FactionKey,
  selections: Record<UnitType, UnitSelection>,
): SideStateData {
  const { units, unitState, unitStats } = getSimulationUnits(
    faction,
    selections,
  )
  return {
    faction,
    units,
    unitState,
    unitStats,
    hitPools: [],
    unitSelections: selections,
  }
}

function analyzeTree(root: ProbabilityNode) {
  let totalNodes = 0
  let maxDepth = 0
  let leafNodes = 0
  let branchNodes = 0
  let maxChildren = 0
  const childCountHisto = new Map()
  const visited = new Set()

  function walk(node: ProbabilityNode, depth: number) {
    if (visited.has(node.id)) return
    visited.add(node.id)
    totalNodes++
    if (depth > maxDepth) maxDepth = depth
    if (node.children.length === 0) {
      leafNodes++
    } else {
      branchNodes++
      if (node.children.length > maxChildren) maxChildren = node.children.length
      const bucket = node.children.length
      childCountHisto.set(bucket, (childCountHisto.get(bucket) ?? 0) + 1)
      for (const child of node.children) {
        walk(child, depth + 1)
      }
    }
  }

  walk(root, 0)

  return {
    totalNodes,
    maxDepth,
    leafNodes,
    branchNodes,
    maxChildren,
    childCountHisto,
  }
}

self.onmessage = (e: MessageEvent<SimulationInput>) => {
  const {
    attackerFaction,
    defenderFaction,
    attackerSelections,
    defenderSelections,
    combatMode,
    abilities,
  } = e.data

  const combatState = CombatState.forSimulation(
    buildSideState(attackerFaction, attackerSelections),
    buildSideState(defenderFaction, defenderSelections),
    combatMode,
    abilities,
  )

  const engine = new CombatEngine()
  console.time('Simulate')
  const tree = engine.simulate(combatState)
  console.log('Simulate tree', tree)
  console.timeEnd('Simulate')
  console.time('Flatten')
  const outcomes = flattenTree(tree)
  console.log('Outcomes list', outcomes)
  console.timeEnd('Flatten')

  console.log(analyzeTree(tree))

  self.postMessage(outcomes)
}
