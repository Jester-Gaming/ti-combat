export {
  AbilitiesEngine,
  type Ability,
  type AbilityBaseParams,
  type AbilityCallContext,
  type AbilityReadContext,
  type AbilityTiming,
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
  getInitialMetaPhase,
  getNextPhaseInFlow,
  GROUND_FLOW,
  type HitSource,
  isCombatMeta,
  type MetaPhase,
  type PhaseMarker,
  type PhaseStep,
  type PhaseTransitionTarget,
  type SideStateData,
  SPACE_FLOW,
  type StateWithProbability,
  UNIT_ABILITY_PHASES,
  type UnitAbilityMeta,
} from './combat-state'
export { type LogEntry, Logger } from './logger'
export type { CombatOutcome, SurvivorSide } from './types'
export { nextUnitIds } from './utils/unit-id'
export { makeVariantId, parseVariantId } from './utils/unit-variant'
