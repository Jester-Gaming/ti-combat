import type {
  FactionKey,
  SourcedDiceGroup,
  Unit,
  UnitAbility,
  UnitState,
  UnitType,
} from '@/types'

import type { CombatMode, CombatStateData, MetaPhase } from '../state/types'

export interface DeclaredParticipant {
  unitType: UnitType
  combatMode: CombatMode
}

export interface DeclaredSubtype {
  name: string
  unitType: UnitType
}

export interface DestroyedUnit {
  type: UnitType
  unit: Unit
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

// Per-unit dice pool: indices match the unit list for each type
export type DicePool = Partial<Record<UnitType, SourcedDiceGroup[]>>

// Sided version for external API
export type SidedDiceData = SidedContext<DicePool>

// ============================================================================
// DICE API — read-only (for isCallable) and read-write (for call)
// ============================================================================

/** Read-only API for querying dice */
export interface DiceReadApi {
  getAll(): DicePool
  get(source: UnitType): readonly SourcedDiceGroup[] | undefined
  count(): number
  isEmpty(): boolean
}

/** Full read-write API for mutating dice */
export interface DiceApi extends DiceReadApi {
  modifyHitValue(amount: number): void
  modifyHitValue(amount: number, unit: Unit): void
  modifyHitValue(amount: number, source: UnitType): void
  modifyHitValue(amount: number, filter: (source: UnitType) => boolean): void

  addDice(count: number): void
  addDice(count: number, strategy: 'BEST' | 'WORST'): void
  addDice(count: number, source: UnitType): void
}

export type DiceReadContext = OwnOpponentContext<DiceReadApi>
export type DiceContext = OwnOpponentContext<DiceApi>

// Single source of truth - map timing to context type (external API uses sided format)
// void = no context, other type = required context
export interface TimingContextMap {
  PREPARE: void
  START_OF_COMBAT: void
  START_OF_COMBAT_ROUND: void
  BEFORE_UNIT_ABILITY_ROLL: SidedDiceData
  BEFORE_DICE_ROLL: SidedDiceData
  BEFORE_ASSIGN_HITS: void
  AFTER_DESTROY: SidedContext<DestroyedUnit[]>
  END_OF_COMBAT_ROUND: void
  END_OF_COMBAT: void
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
// SIDED API — read-only (for isCallable) and read-write (for call)
// ============================================================================

/** Read-only API for querying one side's state */
export interface SideReadApi {
  getFaction(): FactionKey
  getUnits(): Partial<Record<UnitType, Unit[]>>
  getUnits(unitType: UnitType): Unit[]
  hasUnit(unitType: UnitType): boolean
  countUnits(filter?: ReadonlySet<UnitType>): number
  getPendingHits(): number
  getHitPoolValidTargets(): UnitType[]
  /** Get participating base unit types from SETTINGS, filtered to units present on this side.
   *  Pass `combatMode` to override the current combat mode (e.g., for abilities with a fixed context). */
  getParticipatingUnitTypes(options?: { combatMode?: CombatMode }): UnitType[]
  /** Get participating unit types + variant IDs from declared subtypes.
   *  Pass `combatMode` in filter to override the current combat mode.
   *  `include`/`exclude` filter base unit types; `excludeSubtypes` removes variants that contain a given subtype name. */
  getParticipatingVariants(filter?: {
    include?: UnitType[]
    exclude?: UnitType[]
    excludeSubtypes?: string[]
    combatMode?: CombatMode
  }): string[]
  findUnit(
    unitType: UnitType,
    predicate: Partial<UnitState>,
  ): { unit: Unit; index: number } | undefined
  /** Find the first unit matching a priority list of variant IDs.
   *  A plain UnitType matches only units with no subtypes. */
  findUnitByPriority(priority: string[]): Unit | undefined
  isUnitAbilityLost(ability: UnitAbility, unitType: UnitType): boolean
  isUnitAbilityCannotBeUsed(ability: UnitAbility, unitType: UnitType): boolean
}

/** Full read-write API for mutating one side's state (within Immer draft) */
export interface SideApi extends SideReadApi {
  // Unit operations
  destroyUnit(unit: Unit): void
  destroyUnit(unitType: UnitType): void
  destroyUnit(unitType: UnitType, index: number): void
  destroyUnit(unitTypes: UnitType[]): void
  addUnit(units: Partial<Record<UnitType, number>>): void
  modifyUnit(unitType: UnitType, index: number, updates: Partial<Unit>): void
  modifyUnit(unitType: UnitType, updates: Partial<Unit>): void
  modifyUnit(unit: Unit, updates: Partial<Unit>): void

  // Hit operations
  reduceHits(amount: number): void
  addHits(hits: number, validTargets: UnitType[]): void

  // Ability restrictions
  setUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitType,
  ): void
  removeUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitType,
  ): void
  setUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitType,
  ): void
  removeUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitType,
  ): void

  // Subtype operations
  addSubtype(unitType: UnitType, index: number, subtype: string): void
  removeSubtype(unitType: UnitType, index: number, subtype: string): void

  // Ability config mutations
  updateAbilityConfig(updates: Record<string, unknown>): void
  updateAbilityConfig(key: string, updates: Record<string, unknown>): void
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
  /** Get the unit instance this ability is attached to. Throws if called from a non-unit ability. */
  getUnit(): Unit
}

/** Mutable context for call (Immer draft, full API) */
export interface AbilityCallContext {
  state: CombatStateData // Immer draft
  api: {
    own: SideApi
    opponent: SideApi
  }
  log(...data: unknown[]): void
  /** Get the unit instance this ability is attached to (Immer draft). Throws if called from a non-unit ability. */
  getUnit(): Unit
}

/** Per-side abilities accessor for use within ability context */
export interface SideAbilities {
  get(key: string): AbilityInstance | undefined
  has(key: string): boolean
}

// Auto-generate invoke type for each timing
// Uses InternalTimingContextMap for ability perspective (own/opponent)
type AbilityInvokeFor<TParams, T extends AbilityTiming> = {
  timing: T
  /** If true, this invoke can be called multiple times per timing phase. Default: false */
  multi?: boolean
  /** Restrict this invoke to specific meta-phase(s). When set, the invoke only fires if the current meta-phase matches. */
  context?: MetaPhase | MetaPhase[]
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

type UIConfigItem<TParams = Record<string, unknown>> =
  | UIConfigCheckbox<TParams>
  | UIConfigOrderList<TParams>
  | UIConfigCheckboxList<TParams>
  | UIConfigNumber<TParams>
  | UIConfigSelect<TParams>

type UIConfig<Params = Record<string, unknown>> =
  | UIConfigItem<Params>[]
  | ((ctx: AbilityReadContext, params: Params) => UIConfigItem<Params>[])

/** Conditions for when an ability is available */
export interface AbilityCondition {
  /** Ability is only available to the attacker */
  onlyAttacker?: boolean
  /** Ability is only available to the defender */
  onlyDefender?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Ability<Params extends Record<string, unknown> = any> {
  key: string
  name: string // Display name for UI
  category: string
  defaultParams?: Params
  headerUI?: string & keyof Params // Param key to render in header (checkbox for boolean, number input for number)
  readOnly?: boolean // Show UI but prevent user from changing the enable state
  uiConfig?: UIConfig<Params>
  /** Conditions restricting which side can use this ability */
  condition?: AbilityCondition
  /** Restrict ability to a specific combat mode (SPACE or GROUND). When set, the ability is skipped during combat if the mode doesn't match, and dimmed in the UI. */
  context?: CombatMode
  /** Declare subtypes this ability creates, based on its params */
  declareSubtypes?: (params: Params) => DeclaredSubtype[]
  /** Declare additional unit types that participate in combat (for UI display) */
  declareParticipants?: (params: Params) => DeclaredParticipant[]
  invoke: AbilityInvoke<Params>[]
}

export interface AbilityInstance {
  readonly key: string
  readonly params: Record<string, unknown>
  readonly invoke: AbilityInvoke[]
  readonly enabled: boolean
}
