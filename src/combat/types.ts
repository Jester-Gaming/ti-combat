import type { CombatState as CombatStateClass } from './state/CombatState'

// Re-export state classes and types
export { CombatState, type StateWithProbability } from './state/CombatState'
export { CombatSideState } from './state/CombatSideState'
export type { HitSource, HitPool } from './state/HitPool'

export type CombatSide = 'attacker' | 'defender'

// Alias for use in interfaces below
type CombatState = CombatStateClass

/** Per-unit state (empty now, abilities add properties like sustained) */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Unit {}

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
