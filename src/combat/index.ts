export {
  AbilitiesEngine,
  type Ability,
  type AbilityReadContext,
  type DeclaredSubtype,
  declareParam,
  type DicePool,
  type ParamChange,
  type SettingsParams,
  type SyncSourceConfig,
} from './abilities-engine'
export {
  extractDefaults,
  extractSyncSources,
} from './abilities-engine/declare-param'
export { CombatEngine } from './combat-engine'
export { getOpponentSide } from './combat-side-state/combat-side-state'
export {
  type AbilitiesConfig,
  type CombatMode,
  CombatState,
  type CombatStateData,
  getInitialPhaseIdentifier,
  type HitSource,
  type MetaPhase,
  type MicroPhase,
  type SideStateData,
  type StateWithProbability,
  UNIT_ABILITY_PHASES,
  type UnitAbilityMeta,
} from './combat-state'
export type { LogEntry } from './logger'
export type { CombatOutcome, SurvivorSide } from './types'
export { nextUnitIds } from './utils/unit-id'
export { makeVariantId, parseVariantId } from './utils/unit-variant'
