import type { CombatState as CombatStateClass } from './state/combat-state'

// Re-export state classes and types
export { CombatSideState } from './state/combat-side-state'
export { CombatState, type StateWithProbability } from './state/combat-state'
export type { HitPool, HitSource } from './state/hit-pool'

export type CombatSide = 'attacker' | 'defender'

// Alias for use in interfaces below
type CombatState = CombatStateClass

/** Per-unit state (empty now, abilities add properties like sustained) */

export interface Unit {
  isDamaged?: boolean
}

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
