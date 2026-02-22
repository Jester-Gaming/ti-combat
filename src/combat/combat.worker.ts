import { prepareSimulationConfig } from '@/hooks/combat-setup'
import type { FactionKey, UnitBaseType, UnitSelection } from '@/types'
import { getSimulationUnits } from '@/utils/get-simulation-units'

import { CombatEngine } from './combat-engine'
import { CombatState } from './combat-state'
import type {
  AbilitiesConfig,
  CombatMode,
  SideStateData,
} from './combat-state/types'

export interface SimulationInput {
  attackerFaction: FactionKey
  defenderFaction: FactionKey
  attackerSelections: Record<UnitBaseType, UnitSelection>
  defenderSelections: Record<UnitBaseType, UnitSelection>
  combatMode: CombatMode
  abilities: AbilitiesConfig
}

function buildSideState(
  faction: FactionKey,
  selections: Record<UnitBaseType, UnitSelection>,
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

  console.time('Setup')
  const sideAbilities = prepareSimulationConfig(
    abilities,
    attackerFaction,
    defenderFaction,
    combatMode,
  )
  const combatState = CombatState.forSimulation(
    buildSideState(attackerFaction, attackerSelections),
    buildSideState(defenderFaction, defenderSelections),
    combatMode,
    abilities,
    undefined,
    {
      attacker: sideAbilities.attacker.abilities,
      defender: sideAbilities.defender.abilities,
    },
    {
      attacker: sideAbilities.attacker.unitAbilityKeys,
      defender: sideAbilities.defender.unitAbilityKeys,
    },
  )

  const engine = new CombatEngine()
  console.timeEnd('Setup')
  console.time('Simulate')
  const outcomes = engine.simulate(combatState)
  console.timeEnd('Simulate')
  console.log('Outcomes', outcomes)

  self.postMessage(outcomes)
}
