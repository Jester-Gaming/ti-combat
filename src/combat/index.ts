// Types
export type {
  CombatOutcome,
  CombatSide,
  HitPool,
  HitSource,
  ProbabilityNode,
  ProbabilityState,
  Unit,
} from './types'

// State classes
export { flattenTree } from './probability'
export { CombatState, type StateWithProbability } from './types'
export { CombatSideState } from './types'

// Engine (event-driven combat simulation)
export { CombatEngine, type EngineOptions } from './combat-engine'
