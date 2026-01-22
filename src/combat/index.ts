// Types
export type {
  CombatSide,
  Unit,
  CombatSideState,
  CombatState,
  ProbabilityState,
  ProbabilityNode,
  CombatOutcome,
} from './types'

export { flattenTree } from './probability'

// Engine (event-driven combat simulation)
export { CombatEngine, type EngineOptions } from './CombatEngine'
