import type { CombatMode, SideAbilitiesConfig } from '@/combat'
import type {
  CombatSide,
  FactionKey,
  UnitBaseType,
  UnitSelection,
} from '@/types'

export interface SimulationInput {
  attackerFaction: FactionKey
  defenderFaction: FactionKey
  attackerSelections: Record<UnitBaseType, UnitSelection>
  defenderSelections: Record<UnitBaseType, UnitSelection>
  combatMode: CombatMode
  abilities: Record<CombatSide, SideAbilitiesConfig>
}
