// Types
export type {
  CombatOutcome,
  CombatSide,
  ProbabilityNode,
  SurvivorSide,
} from './types'

// State classes
export { flattenTree } from './probability'
export { CombatSideState, CombatState, type Unit } from './state'

// Engine
export { CombatEngine } from './combat-engine'
