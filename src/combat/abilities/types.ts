import type { DieValue } from '@/types'

import type { CombatSide, CombatStateData, SideState } from '../state/types'

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

// Internal DiceData uses own/opponent (ability perspective)
export type DiceData = OwnOpponentContext<DieValue[]>

// Sided version for external API
export type SidedDiceData = SidedContext<DieValue[]>

// Single source of truth - map timing to context type (external API uses sided format)
// void = no context, other type = required context
export interface TimingContextMap {
  SETUP: void
  START_OF_ROUND: void
  BEFORE_AFB_ROLL: SidedDiceData
  WHEN_AFB_ROLL: SidedDiceData
  BEFORE_SPACE_CANNON: SidedDiceData
  WHEN_SPACE_CANNON: SidedDiceData
  BEFORE_BOMBARDMENT: SidedDiceData
  WHEN_BOMBARDMENT: SidedDiceData
  BEFORE_DICE_ROLL: SidedDiceData
  WHEN_DICE_ROLL: SidedDiceData
  BEFORE_ASSIGN_HITS: void
  END_OF_ROUND: void
  AFTER_ROUND: void
}

// Internal map for ability calls (uses own/opponent)
export interface InternalTimingContextMap {
  SETUP: void
  START_OF_ROUND: void
  BEFORE_AFB_ROLL: DiceData
  WHEN_AFB_ROLL: DiceData
  BEFORE_SPACE_CANNON: DiceData
  WHEN_SPACE_CANNON: DiceData
  BEFORE_BOMBARDMENT: DiceData
  WHEN_BOMBARDMENT: DiceData
  BEFORE_DICE_ROLL: DiceData
  WHEN_DICE_ROLL: DiceData
  BEFORE_ASSIGN_HITS: void
  END_OF_ROUND: void
  AFTER_ROUND: void
}

export type AbilityTiming = keyof TimingContextMap

/** Read-only context for ability execution */
export interface AbilityReadContext {
  readonly own: Readonly<SideState>
  readonly opponent: Readonly<SideState>
  readonly state: Readonly<CombatStateData>
  readonly side: CombatSide
}

/** Result of an ability call - new state and optional modified timing context */
export interface StateChange<TContext = unknown> {
  state: CombatStateData
  context?: TContext
}

/** Per-side abilities accessor for use within ability context */
export interface SideAbilities {
  get(key: string): AbilityInstance | undefined
  has(key: string): boolean
}

/** Legacy mutable context - still used during transition */
export interface AbilityContext {
  own: SideState
  opponent: SideState
  state: CombatStateData
  side: CombatSide
  abilities: {
    own: SideAbilities
    opponent: SideAbilities
  }
}

// Auto-generate invoke type for each timing
// Uses InternalTimingContextMap for ability perspective (own/opponent)
type AbilityInvokeFor<TParams, T extends AbilityTiming> = {
  timing: T
  /** If true, this invoke can be called multiple times per timing phase. Default: false */
  multi?: boolean
} & (InternalTimingContextMap[T] extends void
  ? {
      isCallable?: (ctx: AbilityReadContext, params: TParams) => boolean
      call: (
        ctx: AbilityReadContext,
        params: TParams,
      ) => StateChange<InternalTimingContextMap[T]>
    }
  : {
      isCallable?: (
        ctx: AbilityReadContext,
        params: TParams,
        context: InternalTimingContextMap[T],
      ) => boolean
      call: (
        ctx: AbilityReadContext,
        params: TParams,
        context: InternalTimingContextMap[T],
      ) => StateChange<InternalTimingContextMap[T]>
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

type UIConfigItem<TParams = Record<string, unknown>> =
  | UIConfigCheckbox<TParams>
  | UIConfigOrderList<TParams>
  | UIConfigCheckboxList<TParams>

type UIConfig<Params = Record<string, unknown>> =
  | UIConfigItem<Params>[]
  | ((side: SideState, params: Params) => UIConfigItem<Params>[])

/** Conditions for when an ability is available */
export interface AbilityCondition {
  /** Ability is only available to the defender */
  onlyDefender?: boolean
}

type AbilityCategory =
  | 'GENERAL'
  | 'FACTION'
  | 'AGENDA'
  | 'ENVIRONMENT'
  | 'TECHNOLOGY'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Ability<Params extends Record<string, unknown> = any> {
  key: string
  name: string // Display name for UI
  category: AbilityCategory
  defaultParams?: Params
  enableUI?: boolean // Show enable checkbox in header, controls ENABLED param
  defaultCollapsed?: boolean // Start with config items collapsed
  uiConfig?: UIConfig<Params>
  /** Conditions restricting which side can use this ability */
  condition?: AbilityCondition
  invoke: AbilityInvoke<Params>[]
}

export interface AbilityInstance {
  readonly key: string
  readonly params: Record<string, unknown>
  readonly invoke: AbilityInvoke[]
  readonly enabled: boolean
}
