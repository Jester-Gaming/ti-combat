import type { CombatSideState } from '../state/combat-side-state'
import type { CombatState } from '../state/combat-state'

export type AbilityTiming = 'SETUP' | 'BEFORE_ASSIGN_HITS'

/** Per-side abilities accessor for use within ability context */
export interface SideAbilities {
  get(key: string): AbilityInstance | undefined
  has(key: string): boolean
}

export interface AbilityContext {
  my: CombatSideState
  opponent: CombatSideState
  state: CombatState
  abilities: {
    my: SideAbilities
    opponent: SideAbilities
  }
}

export interface AbilityInvoke<TParams = Record<string, unknown>> {
  timing: AbilityTiming
  isCallable?: (ctx: AbilityContext, params: TParams) => boolean
  call: (ctx: AbilityContext, params: TParams) => void
}

export interface UIConfigItemBase<TParams = Record<string, unknown>> {
  key: keyof TParams // Property name in params (e.g., 'riskDirectHit')
  label: string // Display label (e.g., 'Risk Direct Hit?')
}

export interface UIConfigCheckbox<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'checkbox'
}

export interface UIConfigListItem {
  label: string
  value: string
}

export interface UIConfigOrderList<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'order-list'
  items: UIConfigListItem[]
}

export interface UIConfigCheckboxList<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'checkbox-list'
  items: UIConfigListItem[]
}

export type UIConfigItem<TParams = Record<string, unknown>> =
  | UIConfigCheckbox<TParams>
  | UIConfigOrderList<TParams>
  | UIConfigCheckboxList<TParams>

export type UIConfig<Params = Record<string, unknown>> =
  | UIConfigItem<Params>[]
  | ((side: CombatSideState, params: Params) => UIConfigItem<Params>[])

export interface Ability<Params = Record<string, unknown>> {
  key: string
  name: string // Display name for UI
  category: string
  defaultParams?: Params
  enableUI?: boolean // Show enable checkbox in header, controls ENABLED param
  defaultCollapsed?: boolean // Start with config items collapsed
  uiConfig?: UIConfig<Params>
  invoke: AbilityInvoke<Params>[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAbility = Ability<any>

export interface AbilityInstance {
  readonly key: string
  readonly params: Record<string, unknown>
  readonly invoke: AbilityInvoke[]
  readonly enabled: boolean
  modifyParams(updates: Record<string, unknown>): void
  setEnabled(enabled: boolean): void
}
