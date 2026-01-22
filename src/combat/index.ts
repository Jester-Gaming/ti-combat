// Types
export type {
  CombatSide,
  Unit,
  CombatSideState,
  CombatState,
  CombatPhase,
  SubTiming,
  ProbabilityState,
  ProbabilityNode,
  CombatOutcome,
} from './types'

export { flattenTree } from './probability'

// Engine (event-driven combat simulation)
export { CombatEngine, type EngineOptions } from './engine'

// Events (for extending combat with custom handlers)
export {
  CombatEventBus,
  PRIORITY,
  type Priority,
  type CombatEventName,
  type CombatEventContext,
  type HandlerResult,
  type EventHandler,
} from './events'
