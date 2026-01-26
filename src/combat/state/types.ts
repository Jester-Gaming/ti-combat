import type { FactionKey, UnitAbilities, UnitDieValue, UnitType } from '@/types'

import type { Ability } from '../abilities/types'

/** Combat phase in the phase-based state machine */
export type CombatPhase =
  | 'START_OF_ROUND'
  | 'AFB_ROLL'
  | 'AFB_ASSIGN_HITS'
  | 'DICE_ROLL'
  | 'ASSIGN_HITS'
  | 'END_OF_ROUND'
  | 'AFTER_ROUND'

/** Unit stats - defines the unit's capabilities */
export interface UnitStats {
  COMBAT?: UnitDieValue | null
  UNIT_ABILITIES?: UnitAbilities
  ABILITIES?: readonly Ability[]
}

/** Unit instance state - runtime state of a single unit */
export interface UnitState {
  isDamaged?: boolean
  usedSustainThisRound?: boolean
}

/** A single unit combining stats and runtime state */
export type Unit = UnitStats & UnitState

/** A pool of unassigned hits with valid targets */
export interface HitPool {
  hits: number
  validTargets: UnitType[]
}

/** State for one side of combat */
export interface SideState {
  faction: FactionKey
  units: Partial<Record<UnitType, Unit[]>>
  hitPools: HitPool[]
}

/** Ability configuration for one side */
export interface SideAbilitiesConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abilities: readonly any[]
  config?: Record<string, Record<string, unknown>>
}

/** Ability configuration for both sides */
export interface AbilitiesConfig {
  attacker: SideAbilitiesConfig
  defender: SideAbilitiesConfig
}

/** Complete combat state data */
export interface CombatStateData {
  attacker: SideState
  defender: SideState
  abilities: AbilitiesConfig
  phase: CombatPhase
}

/** Combat side identifier */
export type CombatSide = 'attacker' | 'defender'
