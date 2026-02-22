import type { AbilitiesConfig, CombatMode } from '@/combat'
import type { FactionKey, UnitBaseType, UnitSelection } from '@/types'

export interface SimulationInput {
  attackerFaction: FactionKey
  defenderFaction: FactionKey
  attackerSelections: Record<UnitBaseType, UnitSelection>
  defenderSelections: Record<UnitBaseType, UnitSelection>
  combatMode: CombatMode
  abilities: AbilitiesConfig
}
