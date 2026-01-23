import type { CombatSideState } from '../state/combat-side-state'
import type { CombatState } from '../state/combat-state'
import type { CombatSide } from '../types'

export type AbilityTiming = 'SETUP' | 'BEFORE_ASSIGN_HITS'

/** Per-side abilities accessor for use within ability context */
export interface SideAbilities {
  get(key: string): AbilityInstance | undefined
  has(key: string): boolean
}

export interface AbilityContext {
  side: CombatSide
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

export interface UIConfigItem<TParams = Record<string, unknown>> {
  key: keyof TParams // Property name in params (e.g., 'riskDirectHit')
  label: string // Display label (e.g., 'Risk Direct Hit?')
  type: 'checkbox' // UI control type (only checkbox for now)
}

export interface Ability<Params = Record<string, unknown>> {
  key: string
  name: string // Display name for UI
  category: string
  params?: Params
  enableUI?: boolean // Show enable checkbox in header, controls ENABLED param
  uiConfig?: UIConfigItem<Params>[]
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
