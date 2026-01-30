import type { Faction, FactionKey } from './faction'
import type { UnitType } from './unit'

export interface UnitSelection {
  count: number
  upgraded: boolean
}

export type CombatSide = 'attacker' | 'defender'

export interface SideState {
  faction: FactionKey
  units: Record<UnitType, UnitSelection>
}

export interface BattleState {
  attacker: SideState
  defender: SideState
}

export type { Faction, FactionKey }
export type { DiceGroup, SourcedDiceGroup } from './die'
export type {
  Unit,
  UnitAbility,
  UnitDefinition,
  UnitState,
  UnitStats,
} from './unit'
export type { UnitType }
