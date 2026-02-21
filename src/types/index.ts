export interface UnitSelection {
  count: number
  upgraded: boolean
}

export type CombatSide = 'attacker' | 'defender'

export type { DiceGroup, SourcedDiceGroup } from './die'
export type { Faction, FactionKey } from './faction'
export type {
  Unit,
  UnitAbility,
  UnitBaseType,
  UnitDefinition,
  UnitId,
  UnitState,
  UnitStats,
  UnitVariant,
} from './unit'
export { UNIT_STATE_KEYS } from './unit'
