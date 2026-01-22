// Types
export type {
  CombatSide,
  Unit,
  ProbabilityState,
  ProbabilityNode,
  CombatOutcome,
  HitSource,
  HitPool,
} from './types'

// State classes
export { CombatState, type StateWithProbability } from './types'
export { CombatSideState } from './types'

export { flattenTree } from './probability'

// Engine (event-driven combat simulation)
export { CombatEngine, type EngineOptions } from './CombatEngine'
