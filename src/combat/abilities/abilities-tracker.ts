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

/** Config for a single ability - params overrides */
type AbilityConfig = Record<string, unknown>

/** Config for all abilities on one side */
type SideConfig = Record<string, AbilityConfig>

class AbilityInstanceImpl implements AbilityInstance {
  private ability: AnyAbility
  private _params: Record<string, unknown>
  private _enabled: boolean

  constructor(ability: AnyAbility, configParams?: AbilityConfig) {
    this.ability = ability
    // Merge defaultParams with config overrides
    this._params = {
      ...ability.defaultParams,
      ...configParams,
    }
    this._enabled = true
  }

  get key(): string {
    return this.ability.key
  }

  get params(): Record<string, unknown> {
    return this._params
  }

  get invoke(): AbilityInvoke[] {
    return this.ability.invoke
  }

  get enabled(): boolean {
    return this._enabled
  }

  modifyParams(updates: Record<string, unknown>): void {
    Object.assign(this._params, updates)
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled
  }

  clone(): AbilityInstanceImpl {
    const cloned = new AbilityInstanceImpl(this.ability, { ...this._params })
    cloned._enabled = this._enabled
    return cloned
  }
}

/** Per-side abilities collection */
class SideAbilitiesImpl implements SideAbilities {
  private abilities: Map<string, AbilityInstanceImpl>

  constructor(allAbilities: AnyAbility[], config: SideConfig)
  constructor(abilities: Map<string, AbilityInstanceImpl>)
  constructor(
    arg: AnyAbility[] | Map<string, AbilityInstanceImpl>,
    config?: SideConfig,
  ) {
    if (arg instanceof Map) {
      this.abilities = arg
    } else {
      this.abilities = new Map()
      for (const ability of arg) {
        const abilityConfig = config?.[ability.key]
        this.abilities.set(
          ability.key,
          new AbilityInstanceImpl(ability, abilityConfig),
        )
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

export interface SideAbilitiesOptions {
  abilities: AnyAbility[]
  config?: SideConfig
}

export interface AbilitiesTrackerOptions {
  attacker: SideAbilitiesOptions
  defender: SideAbilitiesOptions
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

  static create(options: AbilitiesTrackerOptions): AbilitiesTracker {
    const { attacker, defender } = options
    return new AbilitiesTracker(
      new SideAbilitiesImpl(attacker.abilities, attacker.config ?? {}),
      new SideAbilitiesImpl(defender.abilities, defender.config ?? {}),
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
   * Optionally accepts a context object that gets passed to ability calls.
   * Each invoke is called at most once per timing phase unless multi: true.
   */
  runAbilities<TContext = undefined>(
    timing: AbilityTiming,
    state: CombatState,
    context?: TContext,
  ): void {
    // Track which invokes have been called (keyed by "side:abilityKey:invokeIndex")
    const calledInvokes = new Set<string>()
    let consecutiveSkips = 0
    let currentSide: CombatSide = 'attacker'

    while (consecutiveSkips < 2) {
      const resolved = this.tryResolveOneAbility(
        timing,
        currentSide,
        state,
        context,
        calledInvokes,
      )

      if (resolved) {
        consecutiveSkips = 0
      } else {
        consecutiveSkips += 1
      }

      currentSide = currentSide === 'attacker' ? 'defender' : 'attacker'
    }
  }

  private tryResolveOneAbility<TContext>(
    timing: AbilityTiming,
    side: CombatSide,
    state: CombatState,
    context: TContext | undefined,
    calledInvokes: Set<string>,
  ): boolean {
    const sideAbilities = this.getSideAbilities(side)
    const invokes = sideAbilities.getInvokesForTiming(timing)
    const ctx = this.buildContext(side, state)

    for (const { ability, invoke } of invokes) {
      const invokeKey = `${side}:${ability.key}:${ability.invoke.indexOf(invoke)}`

      // Skip if already called and not multi
      if (!invoke.multi && calledInvokes.has(invokeKey)) {
        continue
      }

      const params = ability.params
      const canCall = invoke.isCallable
        ? invoke.isCallable(ctx, params, context)
        : true
      if (canCall) {
        invoke.call(ctx, params, context)
        calledInvokes.add(invokeKey)
        return true
      }
    }
    return false
  }

  private buildContext(side: CombatSide, state: CombatState): AbilityContext {
    const opponentSide: CombatSide =
      side === 'attacker' ? 'defender' : 'attacker'

    return {
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
