import type { CombatSide } from '../types'
import type { CombatSideState } from '../state/CombatSideState'
import type { CombatState } from '../state/CombatState'

export type AbilityTiming = 'SETUP' | 'BEFORE_ASSIGN_HITS'

/** Per-side abilities accessor for use within ability context */
export interface SideAbilities {
  get(name: string): AbilityInstance | undefined
  has(name: string): boolean
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

export interface Ability {
  name: string
  params?: Record<string, unknown>
  invoke: AbilityInvoke[]
}

export interface AbilityInstance {
  readonly name: string
  readonly params: Record<string, unknown>
  readonly invoke: AbilityInvoke[]
  readonly enabled: boolean
  modifyParams(updates: Record<string, unknown>): void
  setEnabled(enabled: boolean): void
}
