import type { ProbabilityState } from '../types'

/**
 * All combat event names that can be emitted during simulation.
 * These represent the phases of combat that handlers can subscribe to.
 */
export type CombatEventName =
  | 'START_OF_COMBAT_ROUND'
  | 'BEFORE_AFB_ROLLS'
  | 'AFB_ROLLS'
  | 'BEFORE_ASSIGN_AFB_HITS'
  | 'ASSIGN_AFB_HITS'
  | 'BEFORE_COMBAT_ROLLS'
  | 'COMBAT_ROLLS'
  | 'BEFORE_ASSIGN_HITS'
  | 'ASSIGN_HITS'
  | 'AFTER_COMBAT_ROUND'

/**
 * Context passed to event handlers.
 * Handlers operate on all probability states (parallel universes).
 */
export interface CombatEventContext {
  /** All current probability-weighted states */
  states: ProbabilityState[]
  /** Current combat round (1-based) */
  round: number
}

/**
 * Result returned by event handlers.
 * Handlers can transform or branch states (e.g., dice rolls create multiple branches).
 */
export interface HandlerResult {
  /** Transformed probability states */
  states: ProbabilityState[]
}

/**
 * Event handler function signature.
 * Receives context with all states and returns transformed states.
 */
export type EventHandler = (context: CombatEventContext) => HandlerResult

/**
 * Registered handler with priority for ordering.
 */
export interface RegisteredHandler {
  handler: EventHandler
  priority: number
}
