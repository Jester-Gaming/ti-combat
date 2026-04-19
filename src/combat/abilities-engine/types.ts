import type {
  CombatSide,
  DiceGroup,
  SourcedDiceGroup,
  UnitBaseType,
  UnitId,
  UnitType,
  UnitVariantId,
} from '@/types'

import type {
  CombatMode,
  CombatStateData,
  MetaPhase,
  UnitAbilityMeta,
} from '../combat-state/types'
import type { Logger } from '../logger'
import type { SideApi } from './api/ability-api'

export interface SyncSourceConfig<
  K extends keyof SettingsParams = keyof SettingsParams,
> {
  key: string
  group: K
  side: 'own' | 'opponent'
  sort: 'asc' | 'desc'
  compute?: (value: SettingsParams[K]) => unknown
  filter?: (value: string) => boolean
}

export interface DeclaredSubtype {
  name: UnitVariantId
  unitType: UnitType
  /** Ability key that declared this subtype — auto-populated by the reconcile
   *  pass from `ability.declareParamChange`. Abilities don't set this
   *  themselves. Used by `excludeSubtypeSource` on `getUnitVariantsOptions`
   *  so an ability can hide its own declarations while keeping equivalent
   *  declarations from other abilities visible. */
  source?: string
}

export type SettingsParams = {
  nonFighterShips: UnitBaseType[]
  ships: UnitBaseType[]
  groundForces: UnitBaseType[]
  structures: UnitBaseType[]
  spaceCombatParticipating: UnitBaseType[]
  groundCombatParticipating: UnitBaseType[]
  validTargetsSpaceCannonOffense: UnitBaseType[]
  validTargetsBombardment: UnitBaseType[]
  validTargetsSpaceCannonDefense: UnitBaseType[]
  validTargetsAntiFighterBarrage: UnitBaseType[]
  subtypes: DeclaredSubtype[]
}

export type ParamChange = {
  [K in keyof SettingsParams]: {
    key: K
    value: SettingsParams[K] extends (infer E)[] ? E : SettingsParams[K]
  }
}[keyof SettingsParams]

// Sided context (external API - attacker/defender perspective)
export interface SidedContext<T> {
  attacker: T
  defender: T
}

// Own/Opponent context (ability perspective - relative to current side)
export interface OwnOpponentContext<T> {
  own: T
  opponent: T
}

// Dice pool: keyed by unit type or ability name
export type DicePool = Partial<Record<string, SourcedDiceGroup[]>>

// Sided version for external API
export type SidedDiceData = SidedContext<DicePool>

// ============================================================================
// DICE API — read-only (for isCallable) and read-write (for call)
// ============================================================================

/** Read-only API for querying dice */
export interface DiceReadApi {
  getAll(): DicePool
  get(source: string): readonly SourcedDiceGroup[] | undefined
  isEmpty(): boolean
}

/** Full read-write API for mutating dice */
export interface DiceApi extends DiceReadApi {
  addDiceCount(count: number): void
  addDiceCount(count: number, strategy: 'BEST' | 'WORST'): void
  addDiceCount(count: number, source: UnitBaseType): void
  addDiceCount(count: number, unit: UnitId): void

  setDiceCount(count: number, unit: UnitId): void

  addDiceGroup(source: string, unit: UnitId, diceGroup: DiceGroup): void
}

export type DiceReadContext = OwnOpponentContext<DiceReadApi>
export type DiceContext = OwnOpponentContext<DiceApi>

// Single source of truth - map timing to context type (external API uses sided format)
// void = no context, other type = required context
export interface TimingContextMap {
  CLEANUP: void
  PREPARE: void
  COMMIT_UNITS: void
  START_OF_COMBAT: void
  START_OF_COMBAT_ROUND: void
  BEFORE_UNIT_ABILITY_ROLL: SidedDiceData
  AFTER_UNIT_ABILITY_ROLL: void
  BEFORE_DICE_ROLL: SidedDiceData
  AFTER_DICE_ROLL: void
  BEFORE_ASSIGN_HITS: void
  AFTER_ASSIGN_HITS_STEP: void
  WHEN_INDOCTRINATION: UnitId
  WHEN_GALVANIZE: UnitId
  WHEN_SUSTAIN_DAMAGE_USE: UnitId
  AFTER_SUSTAIN_DAMAGE_USE: UnitId
  DESTROY: SidedContext<Record<UnitType, UnitId[]>>
  WHEN_DESTROY: SidedContext<Record<UnitType, UnitId[]>>
  AFTER_DESTROY: SidedContext<Record<UnitType, UnitId[]>>
  END_OF_COMBAT_ROUND: void
  AFTER_COMBAT_ROUND: void
  END_OF_COMBAT: void
  CLEANUP_ROUND: void
  AFTER_ROUND: void
}

// Internal map for ability calls (uses own/opponent)
// Derived from TimingContextMap: SidedContext<T> -> OwnOpponentContext<T>
type ToInternal<T> = T extends SidedContext<infer U> ? OwnOpponentContext<U> : T

export type InternalTimingContextMap = {
  [K in keyof TimingContextMap]: ToInternal<TimingContextMap[K]>
}

export type AbilityTiming = keyof TimingContextMap

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/** Read-only context for isCallable (no Immer, no mutations) */
export interface AbilityReadContext {
  readonly state: Readonly<CombatStateData>
  readonly api: {
    readonly own: SideApi
    readonly opponent: SideApi
  }
  /** The absolute CombatSide this ability is currently running on. */
  readonly side: CombatSide
  /** All abilities registered for each side — available regardless of enabled state.
   *  Use for UI generation (e.g., selects listing agents from both sides). */
  readonly abilities: OwnOpponentContext<readonly Ability[]>
  /** Reference to the ability that is currently running — set by the engine
   *  before each `isCallable`/`call` invocation and by the UI before `uiConfig`.
   *  Lets helpers like `excludeSubtypeSource: [ctx.this.key]` stay generic. */
  readonly this: Ability
  /** Get the UnitId this ability is attached to. Throws if called from a non-unit ability. */
  getUnit(): UnitId
  /** Get enabled config abilities matching the given timing(s) for the current side. */
  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[]
  /** Returns true if the current side's faction owns this ability (faction or unit ability). */
  isOwner(): boolean
}

/** Mutable context for call (Immer draft, full API) */
export interface AbilityCallContext {
  state: CombatStateData // Immer draft
  api: {
    own: SideApi
    opponent: SideApi
  }
  /** The absolute CombatSide this ability is currently running on. */
  readonly side: CombatSide
  /** All abilities registered for each side — available regardless of enabled state. */
  readonly abilities: OwnOpponentContext<readonly Ability[]>
  /** Reference to the ability that is currently running — set by the engine
   *  before each `isCallable`/`call` invocation. */
  readonly this: Ability
  logger?: Logger
  /** Run abilities for the given timing inline during this call */
  trigger<K extends AbilityTiming>(name: K, context: TimingContextMap[K]): void
  /** Get the UnitId this ability is attached to. Throws if called from a non-unit ability. */
  getUnit(): UnitId
  /** Get enabled config abilities matching the given timing(s) for the current side. */
  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[]
  /** Returns true if the current side's faction owns this ability (faction or unit ability). */
  isOwner(): boolean
  /** Roll dice mid-ability, creating probability branches.
   *  Computes all per-group outcomes and calls the callback once per outcome,
   *  passing a branch-scoped context that operates on that branch's state.
   *
   *  For multi-outcome rolls, throws AbilityBranchInterrupt after processing —
   *  nothing after rollDice() executes. For empty/single-outcome rolls, the
   *  callback runs in-place on the outer ctx and rollDice returns normally. */
  rollDice(
    dice: DiceGroup[],
    callback: (branchCtx: AbilityCallContext, hits: number[]) => void,
  ): never

  /** Resolve a full unit-ability step (DICE_POOL → BEFORE_UNIT_ABILITY_ROLL →
   *  roll → AFTER_UNIT_ABILITY_ROLL → ASSIGN_HITS → AFTER_ASSIGN_HITS_STEP +
   *  destroy cascade) from within another ability's call. The step runs with
   *  currentPhase.meta temporarily swapped to `meta` so invoke-level `context`
   *  filters and hit-value modifiers match; the outer phase is restored on
   *  every resulting branch.
   *
   *  Fires from the calling ability's side (`ctx.side`).
   *
   *  Overrides:
   *   - `dice`   — custom dice pool for the firing side; skips collectDice
   *   - `target` — where hits land. `'OPPONENT'` (default) or `'OWN'`
   *                (self-damage, e.g. Proxima's second roll)
   *
   *  Composition: to run multiple resolves sequentially, nest them inside
   *  `callback`. Sequencing two top-level calls does NOT work because the
   *  first will throw `AbilityBranchInterrupt` on multi-outcome. */
  resolveStep<M extends UnitAbilityMeta>(
    meta: M,
    overrides?: {
      dice?: DiceGroup[]
      target?: 'OWN' | 'OPPONENT'
    },
    callback?: (branchCtx: AbilityCallContext) => void,
  ): void
}

// Auto-generate invoke type for each timing
// Uses InternalTimingContextMap for ability perspective (own/opponent)
type AbilityInvokeFor<TParams, T extends AbilityTiming> = {
  timing: T
  /** Restrict this invoke to specific meta-phase(s). When set, the invoke only fires if the current meta-phase matches. SPACE_COMBAT also matches AFB (since AFB is part of space combat). */
  context?: MetaPhase | MetaPhase[]
  /** Filter invoke by trigger side. 'OWN' = only fires for the side that caused the trigger. 'OPPONENT' = only fires for the other side. Omit for no filtering. */
  side?: 'OWN' | 'OPPONENT'
  /** System invokes bypass the `uses` accounting — they don't decrement `uses`
   *  and aren't gated by `uses > 0`. Use for paired teardown invokes
   *  (e.g. CLEANUP_ROUND after START_OF_COMBAT_ROUND setup) so the pair counts
   *  as a single use. Rely on `isCallable` to gate firing. Default: false. */
  system?: boolean
} & (InternalTimingContextMap[T] extends void
  ? {
      // Void timings (PREPARE, START_OF_COMBAT, etc.)
      isCallable?: (params: TParams, ctx: AbilityReadContext) => boolean
      call: (ctx: AbilityCallContext, params: TParams) => void
    }
  : InternalTimingContextMap[T] extends OwnOpponentContext<DicePool>
    ? {
        // Dice timings (BEFORE_DICE_ROLL, BEFORE_UNIT_ABILITY_ROLL)
        isCallable?: (
          params: TParams,
          ctx: AbilityReadContext,
          dice: DiceReadContext,
        ) => boolean
        call: (
          ctx: AbilityCallContext,
          params: TParams,
          dice: DiceContext,
        ) => void
      }
    : {
        // Other context timings (AFTER_DESTROY)
        isCallable?: (
          params: TParams,
          ctx: AbilityReadContext,
          context: InternalTimingContextMap[T],
        ) => boolean
        call: (
          ctx: AbilityCallContext,
          params: TParams,
          context: InternalTimingContextMap[T],
        ) => InternalTimingContextMap[T] | void
      })

// Union of all timing invoke types (auto-generated)
export type AbilityInvoke<TParams = Record<string, unknown>> = {
  [K in AbilityTiming]: AbilityInvokeFor<TParams, K>
}[AbilityTiming]

interface UIConfigItemBase<TParams = Record<string, unknown>> {
  key: keyof TParams // Property name in params (e.g., 'riskDirectHit')
  label?: string // Display label (e.g., 'Risk Direct Hit?')
  /** Override the rendered default. When set, takes precedence over the
   *  value extracted from `ability.params`. Used when an ability's UI
   *  needs to mirror another ability's saved state (e.g. Ssruu). */
  defaultValue?: unknown
}

interface UIConfigCheckbox<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'checkbox'
}

interface UIConfigOrderList<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'order-list'
  items: {
    label: string
    value: string
  }[]
}

interface UIConfigCheckboxList<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'checkbox-list'
  items: {
    label: string
    value: string
  }[]
}

interface UIConfigPriorityList<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'priority-list'
  items: {
    label: string
    value: string
  }[]
}

interface UIConfigNumber<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'number'
  min?: number
  max?: number
}

export type SelectItem = { label: string; value: string }
export type SelectGroup = {
  group: string
  items: { label: string; value: string }[]
}

interface UIConfigSelect<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'select'
  items: (SelectItem | SelectGroup)[]
}

interface UIConfigNumberList<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'number-list'
  items: {
    label: string
    value: string
    max?: number
  }[]
}

export type UIConfigItem<TParams = Record<string, unknown>> =
  | UIConfigCheckbox<TParams>
  | UIConfigOrderList<TParams>
  | UIConfigCheckboxList<TParams>
  | UIConfigPriorityList<TParams>
  | UIConfigNumber<TParams>
  | UIConfigSelect<TParams>
  | UIConfigNumberList<TParams>

type UIConfig<Params = Record<string, unknown>> =
  | UIConfigItem<Params>[]
  | ((ctx: AbilityReadContext, params: Params) => UIConfigItem<Params>[])

/** Base params present on every ability. Managed by the tracker — abilities don't check these themselves. */
interface AbilityBaseParams {
  isEnabled: boolean
  uses: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Ability<Params extends Record<string, unknown> = any> {
  key: string
  name: string // Display name for UI
  description?: string // Tooltip text describing what the ability does
  icon?: string // Raw SVG string for display next to name
  category: string
  subcategory?: string
  params: AbilityBaseParams & Params
  paramsSchema?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    safeParse: (data: unknown) => { success: boolean; data?: any }
  }
  headerUI?: 'isEnabled' | 'uses' | (string & keyof Params) // Param key to render in header (checkbox for boolean, number input for number)
  readOnly?: boolean // Show UI but prevent user from changing the enable state
  uiConfig?: UIConfig<AbilityBaseParams & Params>
  /** Restrict ability to a specific side (attacker or defender). When set, the ability is only available to that side. */
  side?: CombatSide
  /** Restrict ability to a specific combat mode (SPACE or GROUND). When set, the ability is skipped during combat if the mode doesn't match, and dimmed in the UI. */
  context?: CombatMode
  /** When true, both sides share identical config. Changing params on one side mirrors to the other. */
  sync?: boolean
  /** When true, this unit ability can fire as a config ability when its source unit is not on the field. */
  allowExternal?: boolean
  /** Abilities sharing the same exclusiveGroup are mutually exclusive — enabling one disables others in the group. */
  exclusiveGroup?: string
  /** Called when a user changes a param. Can modify other params in response.
   *  Receives the params with the new value already applied, the changed key, and value.
   *  Return modified params or void to keep unchanged. */
  onParamSet?: (
    currentParams: AbilityBaseParams & Params,
    key: string,
    value: unknown,
  ) => (AbilityBaseParams & Params) | void
  /** Declare param changes (subtypes, group additions) based on ability params.
   *  `settings` contains the current SETTINGS values (ships, groundForces, etc.) during reconciliation. */
  declareParamChange?: (
    params: AbilityBaseParams & Params,
    settings: SettingsParams,
  ) => ParamChange[]
  invoke: AbilityInvoke<AbilityBaseParams & Params>[]
}
