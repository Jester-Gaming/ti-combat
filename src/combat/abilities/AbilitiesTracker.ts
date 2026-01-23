import type { CombatSide } from '../types'
import type { CombatState } from '../state/CombatState'
import type {
  Ability,
  AbilityContext,
  AbilityInstance,
  AbilityInvoke,
  AbilityTiming,
  SideAbilities,
} from './types'

class AbilityInstanceImpl implements AbilityInstance {
  private ability: Ability
  private modifiedParams: Record<string, unknown>
  private _enabled: boolean

  constructor(ability: Ability, params?: Record<string, unknown>) {
    this.ability = ability
    this.modifiedParams = params ?? { ...ability.params }
    this._enabled = true
  }

  get name(): string {
    return this.ability.name
  }

  get params(): Record<string, unknown> {
    return this.modifiedParams
  }

  get invoke(): AbilityInvoke[] {
    return this.ability.invoke
  }

  get enabled(): boolean {
    return this._enabled
  }

  modifyParams(updates: Record<string, unknown>): void {
    Object.assign(this.modifiedParams, updates)
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled
  }

  clone(): AbilityInstanceImpl {
    const cloned = new AbilityInstanceImpl(this.ability, {
      ...this.modifiedParams,
    })
    cloned._enabled = this._enabled
    return cloned
  }
}

/** Per-side abilities collection */
class SideAbilitiesImpl implements SideAbilities {
  private abilities: Map<string, AbilityInstanceImpl>

  constructor(configs: Ability[])
  constructor(abilities: Map<string, AbilityInstanceImpl>)
  constructor(arg: Ability[] | Map<string, AbilityInstanceImpl>) {
    if (arg instanceof Map) {
      this.abilities = arg
    } else {
      this.abilities = new Map()
      for (const config of arg) {
        this.abilities.set(config.name, new AbilityInstanceImpl(config))
      }
    }
  }

  get(name: string): AbilityInstance | undefined {
    return this.abilities.get(name)
  }

  has(name: string): boolean {
    return this.abilities.has(name)
  }

  getInvokesForTiming(
    timing: AbilityTiming,
  ): Array<{ ability: AbilityInstanceImpl; invoke: AbilityInvoke }> {
    const results: Array<{
      ability: AbilityInstanceImpl
      invoke: AbilityInvoke
    }> = []

    for (const ability of this.abilities.values()) {
      if (!ability.enabled) continue
      for (const inv of ability.invoke) {
        if (inv.timing === timing) {
          results.push({ ability, invoke: inv })
        }
      }
    }

    return results
  }

  clone(): SideAbilitiesImpl {
    const clonedMap = new Map<string, AbilityInstanceImpl>()
    for (const [name, instance] of this.abilities) {
      clonedMap.set(name, instance.clone())
    }
    return new SideAbilitiesImpl(clonedMap)
  }
}

export interface AbilitiesTrackerOptions {
  attacker?: Ability[]
  defender?: Ability[]
}

/** Manages abilities for both combat sides */
export class AbilitiesTracker {
  private attackerAbilities: SideAbilitiesImpl
  private defenderAbilities: SideAbilitiesImpl

  constructor(options?: AbilitiesTrackerOptions)
  constructor(attacker: SideAbilitiesImpl, defender: SideAbilitiesImpl)
  constructor(
    arg1?: AbilitiesTrackerOptions | SideAbilitiesImpl,
    arg2?: SideAbilitiesImpl,
  ) {
    if (
      arg1 instanceof SideAbilitiesImpl &&
      arg2 instanceof SideAbilitiesImpl
    ) {
      this.attackerAbilities = arg1
      this.defenderAbilities = arg2
    } else {
      const options = (arg1 as AbilitiesTrackerOptions | undefined) ?? {}
      this.attackerAbilities = new SideAbilitiesImpl(options.attacker ?? [])
      this.defenderAbilities = new SideAbilitiesImpl(options.defender ?? [])
    }
  }

  /** Get abilities for a specific side */
  forSide(side: CombatSide): SideAbilities {
    return side === 'attacker' ? this.attackerAbilities : this.defenderAbilities
  }

  /** Clone the tracker with all ability instances */
  clone(): AbilitiesTracker {
    return new AbilitiesTracker(
      this.attackerAbilities.clone(),
      this.defenderAbilities.clone(),
    )
  }

  /** Run SETUP abilities - each ability called exactly once if callable */
  runSetup(state: CombatState): void {
    this.runSetupForSide('attacker', state)
    this.runSetupForSide('defender', state)
  }

  private runSetupForSide(side: CombatSide, state: CombatState): void {
    const sideAbilities =
      side === 'attacker' ? this.attackerAbilities : this.defenderAbilities
    const ctx = this.buildContext(side, state)

    for (const { ability, invoke } of sideAbilities.getInvokesForTiming(
      'SETUP',
    )) {
      const params = ability.params
      const canCall = invoke.isCallable ? invoke.isCallable(ctx, params) : true
      if (canCall) {
        invoke.call(ctx, params)
      }
    }
  }

  /**
   * Run alternating resolution for abilities at given timing.
   * Loop stops when 2 consecutive skips occur.
   */
  runAbilities(timing: AbilityTiming, state: CombatState): void {
    let consecutiveSkips = 0
    let currentSide: CombatSide = 'attacker'

    while (consecutiveSkips < 2) {
      const resolved = this.tryResolveOneAbility(timing, currentSide, state)

      if (resolved) {
        consecutiveSkips = 0
      } else {
        consecutiveSkips += 1
      }

      currentSide = currentSide === 'attacker' ? 'defender' : 'attacker'
    }
  }

  private tryResolveOneAbility(
    timing: AbilityTiming,
    side: CombatSide,
    state: CombatState,
  ): boolean {
    const sideAbilities =
      side === 'attacker' ? this.attackerAbilities : this.defenderAbilities
    const invokes = sideAbilities.getInvokesForTiming(timing)
    const ctx = this.buildContext(side, state)

    for (const { ability, invoke } of invokes) {
      const params = ability.params
      const canCall = invoke.isCallable ? invoke.isCallable(ctx, params) : true
      if (canCall) {
        invoke.call(ctx, params)
        return true
      }
    }
    return false
  }

  private buildContext(side: CombatSide, state: CombatState): AbilityContext {
    const isAttacker = side === 'attacker'
    return {
      side,
      my: isAttacker ? state.attacker : state.defender,
      opponent: isAttacker ? state.defender : state.attacker,
      state,
      abilities: {
        my: isAttacker ? this.attackerAbilities : this.defenderAbilities,
        opponent: isAttacker ? this.defenderAbilities : this.attackerAbilities,
      },
    }
  }
}
