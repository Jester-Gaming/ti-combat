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
 * - SPACE_COMBAT: Standard space combat rounds (AFB happens in round 1 as a micro-phase)
 *
 * Ground Combat flow:
 * - BOMBARDMENT: Ships with bombardment fire at ground forces
 * - SPACE_CANNON_DEFENSE: Defender's PDS fire at invading ground forces
 * - GROUND_COMBAT: Standard ground combat rounds
 *
 * Both flows end with COMPLETE when combat finishes.
 */
export type MetaPhase =
  | 'SPACE_CANNON_OFFENSE' // PDS fire at ships (space combat only)
  | 'SPACE_COMBAT' // Standard space combat rounds
  | 'BOMBARDMENT' // Ships bombard planet (ground combat only)
  | 'SPACE_CANNON_DEFENSE' // Defender PDS fire at ground forces (ground combat only)
  | 'GROUND_COMBAT' // Standard ground combat rounds
  | 'COMPLETE' // Combat finished

/**
 * MicroPhase represents the steps within a meta-phase.
 *
 * Each meta-phase (except COMPLETE) goes through these steps:
 * - START: Entry point, setup for this meta-phase
 * - AFB: Anti-Fighter Barrage (round 1 only within SPACE_COMBAT)
 * - DICE_ROLL: Roll combat dice
 * - ASSIGN_HITS: Assign hits to enemy units
 * - END: Cleanup, check for combat continuation, transition to next meta-phase
 *
 * Note: AFB fires only in round 1 of SPACE_COMBAT meta-phase.
 * In rounds 2+, SPACE_COMBAT skips directly from START to DICE_ROLL.
 */
export type MicroPhase =
  | 'START' // Entry point for the meta-phase
  | 'AFB' // Anti-Fighter Barrage (round 1 only within SPACE_COMBAT)
  | 'DICE_ROLL' // Rolling dice
  | 'ASSIGN_HITS' // Assigning hits from dice
  | 'END' // Exit point, transition to next meta-phase

/**
 * PhaseIdentifier combines meta and micro phases for complete phase tracking.
 *
 * Example: { meta: 'SPACE_COMBAT', micro: 'AFB' } means we're in Anti-Fighter
 * Barrage during space combat (round 1 only).
 */
export interface PhaseIdentifier {
  meta: MetaPhase
  micro: MicroPhase
}

/**
 * The ordered sequence of meta-phases for space combat.
 * Combat proceeds through these phases in order.
 * Note: AFB is a micro-phase within SPACE_COMBAT, not a separate meta-phase.
 */
export const SPACE_COMBAT_FLOW: readonly MetaPhase[] = [
  'SPACE_CANNON_OFFENSE',
  'SPACE_COMBAT',
  'COMPLETE',
] as const

/**
 * The ordered sequence of meta-phases for ground combat.
 * Combat proceeds through these phases in order.
 */
export const GROUND_COMBAT_FLOW: readonly MetaPhase[] = [
  'BOMBARDMENT',
  'SPACE_CANNON_DEFENSE',
  'GROUND_COMBAT',
  'COMPLETE',
] as const

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
  /** Combat mode (space or ground) - optional during migration to two-tier system */
  combatMode?: CombatMode
  /** Current phase identifier - optional during migration to two-tier system */
  currentPhase?: PhaseIdentifier
}

/** Combat side identifier */
export type CombatSide = 'attacker' | 'defender'

// ============================================================================
// PHASE UTILITIES
// ============================================================================

/**
 * Generates a string key from a phase identifier for caching.
 *
 * @example
 * getPhaseKey({ meta: 'SPACE_COMBAT', micro: 'AFB' }) // => 'SPACE_COMBAT:AFB'
 */
export function getPhaseKey(phase: PhaseIdentifier): string {
  return `${phase.meta}:${phase.micro}`
}
