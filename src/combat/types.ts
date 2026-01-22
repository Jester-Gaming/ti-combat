import type { UnitType, UnitStats } from '@/types'

export type CombatSide = 'attacker' | 'defender'

/** Per-unit state (empty now, abilities add properties like sustained) */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Unit {}

/** State for one side of combat */
export interface CombatSideState {
  stats: Partial<Record<UnitType, UnitStats>>
  units: Partial<Record<UnitType, Unit[]>>
  pendingHits: number
}

/** Full combat state at any point */
export interface CombatState {
  attacker: CombatSideState
  defender: CombatSideState
  round: number
}

export type CombatPhase =
  | 'START_OF_COMBAT'
  | 'START_OF_COMBAT_ROUND'
  | 'BEFORE_AFB_ROLLS' // Abilities before AFB
  | 'AFB_ROLLS' // Core: dice rolled
  | 'BEFORE_ASSIGN_AFB_HITS' // Abilities (sustain damage, etc.)
  | 'ASSIGN_AFB_HITS' // Core: destroy fighters
  | 'BEFORE_COMBAT_ROLLS' // Abilities before combat
  | 'COMBAT_ROLLS' // Core: dice rolled
  | 'BEFORE_ASSIGN_HITS' // Abilities (sustain damage, etc.)
  | 'ASSIGN_HITS' // Core: destroy units
  | 'AFTER_COMBAT_ROUND'
  | 'COMBAT_END'

/**
 * Sub-timing for ability chains.
 * When an ability executes, it can trigger sub-timings.
 * Example: Sustain Damage triggers 'AFTER_SUSTAIN_DAMAGE' sub-timing.
 */
export type SubTiming = 'AFTER_SUSTAIN_DAMAGE'

/** A probability-weighted state */
export interface ProbabilityState {
  state: CombatState
  meta?: Record<string, unknown>
  probability: number
}

/** A node in the probability tree */
export interface ProbabilityNode {
  state: CombatState
  probability: number // relative to parent, children sum to 1
  children: ProbabilityNode[]
  meta?: Record<string, unknown>
}

/** Survivor counts for one side */
export interface SurvivorSide {
  [unitType: string]: number
}

/** Final combat outcome with full survivor info */
export interface CombatOutcome {
  attacker: SurvivorSide
  defender: SurvivorSide
  winner: CombatSide | 'draw'
  probability: number
}
