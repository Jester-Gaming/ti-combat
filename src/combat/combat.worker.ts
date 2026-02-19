import type { FactionKey, UnitSelection, UnitType } from '@/types'
import { getSimulationUnits } from '@/utils/get-simulation-units'

import { CombatEngine } from './combat-engine'
import { CombatState } from './combat-state/combat-state'
import type {
  AbilitiesConfig,
  CombatMode,
  SideStateData,
} from './combat-state/types'

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
  const outcomes = engine.simulate(combatState)
  console.timeEnd('Simulate')
  console.log('Outcomes', outcomes)

  self.postMessage(outcomes)
}
