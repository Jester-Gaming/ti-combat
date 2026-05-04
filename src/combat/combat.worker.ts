import { prepareSimulationConfig } from '@/hooks/combat-setup'
import type { SimulationInput } from '@/hooks/combat-setup/types'
import type { FactionKey, UnitBaseType, UnitList, UnitSelection } from '@/types'
import {
  buildUnitStatsMap,
  getSimulationUnits,
} from '@/utils/get-simulation-units'

import { CombatEngine } from './combat-engine'
import { CombatState } from './combat-state'
import type {
  SideAbilitiesConfig,
  SideStateData,
  UnitStatsEntry,
} from './combat-state/types'

function buildSideState(
  faction: FactionKey,
  selections: Record<UnitBaseType, UnitSelection>,
  abilities: SideAbilitiesConfig,
): SideStateData {
  const upgradedSet = new Set<UnitBaseType>()
  for (const [k, v] of Object.entries(selections)) {
    if (v.upgraded) upgradedSet.add(k as UnitBaseType)
  }
  const { units, unitType, unitState, unitStats } = getSimulationUnits(
    faction,
    selections,
  )
  return {
    faction,
    participatingUnits: units,
    nonParticipatingUnits: '' as UnitList,
    unitType,
    unitState,
    unitStats: {
      ...buildUnitStatsMap(faction, upgradedSet),
      ...unitStats,
    } as Record<string, UnitStatsEntry>,
    hitPools: [],
    abilities,
    liveAbilities: {},
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

  const sideAbilities = prepareSimulationConfig(
    abilities,
    attackerFaction,
    defenderFaction,
    combatMode,
  )
  const combatState = CombatState.forSimulation(
    buildSideState(attackerFaction, attackerSelections, abilities.attacker),
    buildSideState(defenderFaction, defenderSelections, abilities.defender),
    combatMode,
    {
      attacker: sideAbilities.attacker.abilities,
      defender: sideAbilities.defender.abilities,
    },
    {
      attacker: sideAbilities.attacker.unitAbilityKeys,
      defender: sideAbilities.defender.unitAbilityKeys,
    },
    {
      attacker: sideAbilities.attacker.factionOwnedKeys,
      defender: sideAbilities.defender.factionOwnedKeys,
    },
  )

  const engine = new CombatEngine()
  console.time('Simulate')
  const outcomes = engine.simulate(combatState)
  console.timeEnd('Simulate')
  console.log('Outcomes', outcomes)

  self.postMessage(outcomes)
}
