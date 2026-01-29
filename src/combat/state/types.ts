import type {
  FactionKey,
  UnitAbilities,
  UnitAbilityKey,
  UnitDieValue,
  UnitType,
} from '@/types'

import type { Ability } from '../abilities/types'

// ============================================================================
// TWO-TIER PHASE SYSTEM
// ============================================================================
//
// The TI4 combat system uses a two-tier phase structure:
//
// 1. MetaPhase - The major combat stages that define the overall flow.
//    Different combat modes (space vs ground) have different sequences.
//
// 2. MicroPhase - The steps within each meta-phase (START, DICE_ROLL, etc.)
//
// This allows the state machine to track both "what stage of combat are we in"
// (MetaPhase) and "what step within that stage" (MicroPhase).
//
// ============================================================================

/**
 * Combat mode determines which meta-phase flow to use.
 * - SPACE: Space combat between ships (Space Cannon Offense -> Space Combat)
 * - GROUND: Ground combat on planets (Bombardment -> Space Cannon Defense -> Ground Combat)
 */
export type CombatMode = 'SPACE' | 'GROUND'

/**
 * MetaPhase represents the major combat stages in TI4.
 *
 * Space Combat flow:
 * - SPACE_CANNON_OFFENSE: PDS fire at ships before combat begins
 * - AFB: Anti-Fighter Barrage (occurs during round 1 of space combat)
 * - SPACE_COMBAT: Standard space combat rounds
 *
 * Ground Combat flow:
 * - BOMBARDMENT: Ships with bombardment fire at ground forces
 * - SPACE_CANNON_DEFENSE: Defender's PDS fire at invading ground forces
 * - GROUND_COMBAT: Standard ground combat rounds
 *
 * Both flows end with COMPLETE when combat finishes.
 */
export type MetaPhase =
  | 'SPACE_CANNON_OFFENSE'
  | 'AFB'
  | 'SPACE_COMBAT'
  | 'BOMBARDMENT'
  | 'SPACE_CANNON_DEFENSE'
  | 'GROUND_COMBAT'
  | 'COMPLETE'

/** Meta-phases that correspond to unit ability rolls (bombardment, space cannon, AFB). */
export const UNIT_ABILITY_PHASES: MetaPhase[] = [
  'SPACE_CANNON_OFFENSE',
  'AFB',
  'BOMBARDMENT',
  'SPACE_CANNON_DEFENSE',
]

/**
 * MicroPhase represents the steps within a meta-phase.
 *
 * Each meta-phase (except COMPLETE) goes through these steps:
 * - START: Entry point, setup for this meta-phase
 * - DICE_ROLL: Roll combat dice
 * - ASSIGN_HITS: Assign hits to enemy units
 * - END: Cleanup, check for combat continuation, transition to next meta-phase
 */
export type MicroPhase = 'START' | 'DICE_ROLL' | 'ASSIGN_HITS' | 'END'

/**
 * PhaseIdentifier combines meta and micro phases for complete phase tracking.
 *
 * Example: { meta: 'AFB', micro: 'DICE_ROLL' } means we're rolling dice
 * during the Anti-Fighter Barrage phase.
 */
export interface PhaseIdentifier {
  meta: MetaPhase
  micro: MicroPhase
}

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

/** A single restriction entry explaining why an ability is restricted */
export interface RestrictionEntry {
  reason: string
  unitType?: UnitType
}

/** Two-layer restriction system for unit abilities */
export interface UnitAbilityRestrictions {
  cannotBeUsed?: Partial<Record<UnitAbilityKey, RestrictionEntry[]>>
  lost?: Partial<Record<UnitAbilityKey, RestrictionEntry[]>>
}

/** State for one side of combat */
export interface SideState {
  faction: FactionKey
  units: Partial<Record<UnitType, Unit[]>>
  hitPools: HitPool[]
  unitAbilityRestrictions?: UnitAbilityRestrictions
}

/** Ability configuration for one side */
export interface SideAbilitiesConfig {
  abilities: readonly Ability[]
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
  combatMode: CombatMode
  currentPhase: PhaseIdentifier
}

/** Hit source determines dice collection */
export type HitSource = 'COMBAT' | 'AFB' | 'BOMBARDMENT' | 'SPACE_CANNON'

/** Combat side identifier (alias for Side from @/types) */
export { type Side as CombatSide } from '@/types'
