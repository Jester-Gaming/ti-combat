import type { CombatState } from '../state/combat-state'
import type { CombatSide } from '../types'
import type {
  AbilityContext,
  AbilityInstance,
  AbilityInvoke,
  AbilityTiming,
  AnyAbility,
  SideAbilities,
} from './types'

class AbilityInstanceImpl implements AbilityInstance {
  private ability: AnyAbility
  private modifiedParams: Record<string, unknown>
  private _enabled: boolean

  constructor(ability: AnyAbility, params?: Record<string, unknown>) {
    this.ability = ability
    this.modifiedParams = params ?? { ...ability.params }
    this._enabled = true
  }

  get key(): string {
    return this.ability.key
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

  constructor(configs: AnyAbility[])
  constructor(abilities: Map<string, AbilityInstanceImpl>)
  constructor(arg: AnyAbility[] | Map<string, AbilityInstanceImpl>) {
    if (arg instanceof Map) {
      this.abilities = arg
    } else {
      this.abilities = new Map()
      for (const config of arg) {
        this.abilities.set(config.key, new AbilityInstanceImpl(config))
      }
    }
  }

  get(key: string): AbilityInstance | undefined {
    return this.abilities.get(key)
  }

  has(key: string): boolean {
    return this.abilities.has(key)
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
    for (const [key, instance] of this.abilities) {
      clonedMap.set(key, instance.clone())
    }
    return new SideAbilitiesImpl(clonedMap)
  }
}

export interface AbilitiesTrackerOptions {
  attacker?: AnyAbility[]
  defender?: AnyAbility[]
}

/** Manages abilities for both combat sides */
export class AbilitiesTracker {
  private attackerAbilities: SideAbilitiesImpl
  private defenderAbilities: SideAbilitiesImpl

  private constructor(
    attacker: SideAbilitiesImpl,
    defender: SideAbilitiesImpl,
  ) {
    this.attackerAbilities = attacker
    this.defenderAbilities = defender
  }

  static create(options?: AbilitiesTrackerOptions): AbilitiesTracker {
    return new AbilitiesTracker(
      new SideAbilitiesImpl(options?.attacker ?? []),
      new SideAbilitiesImpl(options?.defender ?? []),
    )
  }

  /** Get abilities for a specific side */
  forSide(side: CombatSide): SideAbilities {
    return this.getSideAbilities(side)
  }

  private getSideAbilities(side: CombatSide): SideAbilitiesImpl {
    return side === 'attacker' ? this.attackerAbilities : this.defenderAbilities
  }

  /** Clone the tracker with all ability instances */
  clone(): AbilitiesTracker {
    return AbilitiesTracker.fromCloned(
      this.attackerAbilities.clone(),
      this.defenderAbilities.clone(),
    )
  }

  private static fromCloned(
    attacker: SideAbilitiesImpl,
    defender: SideAbilitiesImpl,
  ): AbilitiesTracker {
    return new AbilitiesTracker(attacker, defender)
  }

  /** Run SETUP abilities - each ability called exactly once if callable */
  runSetup(state: CombatState): void {
    this.runSetupForSide('attacker', state)
    this.runSetupForSide('defender', state)
  }

  private runSetupForSide(side: CombatSide, state: CombatState): void {
    const sideAbilities = this.getSideAbilities(side)
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
    const sideAbilities = this.getSideAbilities(side)
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
    const opponentSide: CombatSide =
      side === 'attacker' ? 'defender' : 'attacker'

    return {
      side,
      my: state[side],
      opponent: state[opponentSide],
      state,
      abilities: {
        my: this.getSideAbilities(side),
        opponent: this.getSideAbilities(opponentSide),
      },
    }
  }
}
