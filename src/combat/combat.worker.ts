import { UNIT_TYPES } from '@/constants/units'
import type { FactionKey, UnitSelection, UnitType } from '@/types'
import {
  buildUnitStatsMap,
  getSimulationUnits,
} from '@/utils/get-simulation-units'

import { CombatEngine } from './combat-engine'
import { CombatState } from './combat-state/combat-state'
import type {
  AbilitiesConfig,
  CombatMode,
  SideStateData,
} from './combat-state/types'
import { flattenTree } from './probability/flatten-tree'

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
  const upgrades = new Set(UNIT_TYPES.filter(t => selections[t].upgraded))
  return {
    faction,
    units: getSimulationUnits(faction, selections),
    hitPools: [],
    unitSelections: selections,
    unitStats: buildUnitStatsMap(faction, upgrades),
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

  self.postMessage(outcomes)
}
