import type { UnitCategory } from '@/constants/units'
import type {
  FactionKey,
  UnitAbility,
  UnitBaseType,
  UnitId,
  UnitState,
  UnitStats,
  UnitType,
} from '@/types'

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
  | 'COMMIT_UNITS'
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

/** A pool of unassigned hits with valid targets */
export interface HitPool {
  hits: number
  validTargets: UnitType[]
}

/** A single restriction entry explaining why an ability is restricted */
export interface RestrictionEntry {
  reason: string
  unitType?: UnitBaseType
  category?: UnitCategory
}

/** Two-layer restriction system for unit abilities */
export interface UnitAbilityRestrictions {
  cannotBeUsed?: Partial<Record<UnitAbility, RestrictionEntry[]>>
  lost?: Partial<Record<UnitAbility, RestrictionEntry[]>>
}

/** A stored hit-value modifier applied after BEFORE_DICE_ROLL abilities */
export interface HitValueModifier {
  amount: number
  unitType?: string
  excludeUnitTypes?: string[]
  unitId?: UnitId
  context: MetaPhase
}

/** A stats entry: either concrete stats or a factory that derives from parent type stats */
export type UnitStatsEntry = UnitStats | ((parentStats: UnitStats) => UnitStats)

/** State data for one side of combat */
export interface SideStateData {
  faction: FactionKey
  /** Variant key → array of UnitIds */
  units: Record<UnitType, UnitId[]>
  /** UnitId → per-unit mutable state (flat map, sparse — only entries with non-default state) */
  unitState: Record<UnitId, UnitState>
  /** Variant key → shared stats template (may be a factory for subtypes) */
  unitStats: Record<UnitType, UnitStatsEntry>
  hitPools: HitPool[]
  unitAbilityRestrictions?: UnitAbilityRestrictions
  /** Stored hit-value modifiers from abilities, applied to dice after BEFORE_DICE_ROLL */
  hitValueModifiers?: HitValueModifier[]
}

/** Ability configuration for both sides */
export interface AbilitiesConfig {
  attacker: Record<string, Record<string, unknown>>
  defender: Record<string, Record<string, unknown>>
}

/** Complete combat state data */
export interface CombatStateData {
  attacker: SideStateData
  defender: SideStateData
  abilities: AbilitiesConfig
  combatMode: CombatMode
  currentPhase: PhaseIdentifier
}

/** Hit source determines dice collection */
export type HitSource = 'COMBAT' | 'AFB' | 'BOMBARDMENT' | 'SPACE_CANNON'
