import type {
  CombatSide,
  DiceGroup,
  FactionKey,
  SourcedDiceGroup,
  Unit,
  UnitAbility,
  UnitBaseType,
  UnitId,
  UnitState,
  UnitStats,
} from '@/types'

import type {
  CombatMode,
  CombatStateData,
  MetaPhase,
} from '../combat-state/types'

export interface ParamChange {
  key: string
  value: unknown
}

export interface SyncSourceConfig {
  key: string
  group: string
  side: 'own' | 'opponent'
  sort: 'asc' | 'desc'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compute?: (value: any) => unknown
  filter?: (value: string) => boolean
}

export interface DeclaredSubtype {
  name: string
  unitType: UnitBaseType
}

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
  WHEN_SUSTAIN_DAMAGE_USE: UnitId
  AFTER_SUSTAIN_DAMAGE_USE: UnitId
  DESTROY: SidedContext<Record<string, UnitId[]>>
  WHEN_DESTROY: SidedContext<Record<string, UnitId[]>>
  AFTER_DESTROY: SidedContext<Record<string, UnitId[]>>
  END_OF_COMBAT_ROUND: void
  END_OF_COMBAT: void
  CLEANUP_ROUND: void
  AFTER_ROUND: void
}

/** Events that can be emitted via ctx.trigger() during produce */
export interface TriggerEventMap {
  WHEN_SUSTAIN_DAMAGE_USE: UnitId
  AFTER_SUSTAIN_DAMAGE_USE: UnitId
}

// Internal map for ability calls (uses own/opponent)
// Derived from TimingContextMap: SidedContext<T> -> OwnOpponentContext<T>
type ToInternal<T> = T extends SidedContext<infer U> ? OwnOpponentContext<U> : T

export type InternalTimingContextMap = {
  [K in keyof TimingContextMap]: ToInternal<TimingContextMap[K]>
}

export type AbilityTiming = keyof TimingContextMap

// ============================================================================
// SIDED API — read-only (for isCallable) and read-write (for call)
// ============================================================================

/** Read-only API for querying one side's state */
export interface SideReadApi {
  getFaction(): FactionKey
  getUnits(): Partial<Record<UnitBaseType, Unit[]>>
  getUnits(unitType: UnitBaseType): Unit[]
  hasUnit(unitType: UnitBaseType): boolean
  countUnits(filter?: UnitBaseType | UnitBaseType[]): number
  getPendingHits(): number
  getHitPoolValidTargets(): UnitBaseType[]
  /** Get participating base unit types from SETTINGS, filtered to units present on this side.
   *  Pass `combatMode` to override the current combat mode (e.g., for abilities with a fixed context). */
  getParticipatingUnitTypes(options?: {
    combatMode?: CombatMode
  }): UnitBaseType[]
  /** Get unit types + variant IDs from declared subtypes.
   *  By default returns only participating units. Pass `includeNonParticipating: true` to include all unit types on this side.
   *  Pass `combatMode` in filter to override the current combat mode.
   *  `include`/`exclude` filter base unit types; `excludeSubtypes` removes variants that contain a given subtype name. */
  getUnitVariants(filter?: {
    include?: UnitBaseType[]
    exclude?: UnitBaseType[]
    excludeSubtypes?: string[]
    combatMode?: CombatMode
    includeNonParticipating?: boolean
  }): string[]
  /** Same as getUnitVariants but returns { label, value } items for UI config. */
  getUnitVariantsOptions(filter?: {
    include?: UnitBaseType[]
    exclude?: UnitBaseType[]
    excludeSubtypes?: string[]
    combatMode?: CombatMode
    includeNonParticipating?: boolean
  }): { label: string; value: string }[]
  /** Find the first unit matching a priority list of variant IDs.
   *  A plain UnitBaseType matches only units with no subtypes. */
  findUnitByPriority(priority: string[]): Unit | undefined
  /** Get the unit stats template for a given type. Returns post-PREPARE values even if no units of this type are in the battle. */
  getUnitStats(unitType: UnitBaseType): Readonly<UnitStats> | undefined
  isUnitAbilityLost(ability: UnitAbility, unitType: UnitBaseType): boolean
  isUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    unitType: UnitBaseType,
  ): boolean

  // Ability config reads
  getAbilityConfig(key: string): Readonly<Record<string, unknown>> | undefined
}

/** Full read-write API for mutating one side's state (within Immer draft) */
export interface SideApi extends SideReadApi {
  // Unit operations
  destroyUnit(unit: UnitId): void
  destroyUnit(unitType: UnitBaseType): void
  /** Remove a unit without triggering AFTER_DESTROY */
  removeUnit(unit: UnitId): void
  removeUnit(unitType: UnitBaseType): void
  placeUnits(units: Partial<Record<UnitBaseType, number>>): void
  modifyUnitType(
    unitTypeOrVariantKey: string,
    updates: Partial<UnitStats>,
  ): void
  modifyUnitState(unit: UnitId, updates: Partial<UnitState>): void

  // Hit operations
  reduceHits(amount: number): void
  addHits(hits: number, validTargets: UnitBaseType[]): void

  // Ability restrictions
  setUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitBaseType,
  ): void
  removeUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitBaseType,
  ): void
  setUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitBaseType,
  ): void
  removeUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitBaseType,
  ): void

  // Subtype operations
  addSubtype(
    variantId: string,
    subtype: string,
    statsFactory?: (parentStats: UnitStats) => UnitStats,
  ): void
  removeSubtype(variantId: string, subtype: string): void

  // Ability config mutations
  updateAbilityConfig(updates: Record<string, unknown>): void
  updateAbilityConfig(key: string, updates: Record<string, unknown>): void

  // Hit value modifiers (stored, applied after BEFORE_DICE_ROLL)
  modifyHitValue(amount: number): void
  modifyHitValue(amount: number, unitType: string): void
  modifyHitValue(amount: number, unit: UnitId): void
  modifyHitValue(amount: number, options: { exclude: string[] }): void
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/** Read-only context for isCallable (no Immer, no mutations) */
export interface AbilityReadContext {
  readonly state: Readonly<CombatStateData>
  readonly api: {
    readonly own: SideReadApi
    readonly opponent: SideReadApi
  }
  /** Get the UnitId this ability is attached to. Throws if called from a non-unit ability. */
  getUnit(): UnitId
  /** Get the variant key for the unit this ability is attached to. Throws if called from a non-unit ability. */
  getVariantKey(): string
  /** Get the per-unit mutable state (isDamaged, etc.). Throws if called from a non-unit ability. */
  getUnitState(): Readonly<UnitState>
  /** Get the shared stats for the unit variant. Throws if called from a non-unit ability. */
  getUnitStats(): Readonly<UnitStats>
  /** Get the unit type this ability is attached to. Throws if called from a non-unit ability. */
  getUnitType(): UnitBaseType
  /** Get enabled config abilities matching the given timing(s) for the current side. */
  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[]
}

/** Stored trigger event emitted via ctx.trigger() */
export interface TriggerEvent {
  name: keyof TriggerEventMap
  side: CombatSide
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
}

/** Mutable context for call (Immer draft, full API) */
export interface AbilityCallContext {
  state: CombatStateData // Immer draft
  api: {
    own: SideApi
    opponent: SideApi
  }
  log(...data: unknown[]): void
  /** Emit a trigger event to be processed immediately after produce */
  trigger<K extends keyof TriggerEventMap>(
    name: K,
    context: TriggerEventMap[K],
  ): void
  /** Get the UnitId this ability is attached to. Throws if called from a non-unit ability. */
  getUnit(): UnitId
  /** Get the variant key for the unit this ability is attached to. Throws if called from a non-unit ability. */
  getVariantKey(): string
  /** Get the per-unit mutable state (isDamaged, etc.). Throws if called from a non-unit ability. */
  getUnitState(): Readonly<UnitState>
  /** Get the shared stats for the unit variant. Throws if called from a non-unit ability. */
  getUnitStats(): Readonly<UnitStats>
  /** Get the unit type this ability is attached to. Throws if called from a non-unit ability. */
  getUnitType(): UnitBaseType
  /** Get enabled config abilities matching the given timing(s) for the current side. */
  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[]
}

// Auto-generate invoke type for each timing
// Uses InternalTimingContextMap for ability perspective (own/opponent)
type AbilityInvokeFor<TParams, T extends AbilityTiming> = {
  timing: T
  /** Restrict this invoke to specific meta-phase(s). When set, the invoke only fires if the current meta-phase matches. */
  context?: MetaPhase | MetaPhase[]
  /** Filter invoke by trigger side. 'OWN' = only fires for the side that caused the trigger. 'OPPONENT' = only fires for the other side. Omit for no filtering. */
  side?: 'OWN' | 'OPPONENT'
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
  label: string // Display label (e.g., 'Risk Direct Hit?')
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

interface UIConfigSelect<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'select'
  items: {
    label: string
    value: string
  }[]
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

type UIConfigItem<TParams = Record<string, unknown>> =
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
export interface AbilityBaseParams {
  isEnabled: boolean
  uses: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Ability<Params extends Record<string, unknown> = any> {
  key: string
  name: string // Display name for UI
  icon?: string // Raw SVG string for display next to name
  category: string
  subcategory?: string
  params: AbilityBaseParams & Params
  headerUI?: 'isEnabled' | 'uses' | (string & keyof Params) // Param key to render in header (checkbox for boolean, number input for number)
  readOnly?: boolean // Show UI but prevent user from changing the enable state
  uiConfig?: UIConfig<AbilityBaseParams & Params>
  /** Restrict ability to a specific side (attacker or defender). When set, the ability is only available to that side. */
  side?: CombatSide
  /** Restrict ability to a specific combat mode (SPACE or GROUND). When set, the ability is skipped during combat if the mode doesn't match, and dimmed in the UI. */
  context?: CombatMode
  /** When true, both sides share identical config. Changing params on one side mirrors to the other. */
  sync?: boolean
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
    settings: Readonly<Record<string, unknown>>,
  ) => ParamChange[]
  invoke: AbilityInvoke<AbilityBaseParams & Params>[]
}
