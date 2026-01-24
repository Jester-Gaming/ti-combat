import type { CombatState } from '../state/combat-state'
import type { CombatSide } from '../types'
import type {
  Ability,
  AbilityContext,
  AbilityInstance,
  AbilityInvoke,
  AbilityTiming,
  InternalTimingContextMap,
  OwnOpponentContext,
  SideAbilities,
  SidedContext,
  TimingContextMap,
} from './types'

// Type guard to detect sided objects (attacker/defender)
function isSidedContext<T>(ctx: unknown): ctx is SidedContext<T> {
  return (
    typeof ctx === 'object' &&
    ctx !== null &&
    'attacker' in ctx &&
    'defender' in ctx
  )
}

// Transform sided -> own/opponent based on current side
function toOwnOpponent<T>(
  sided: SidedContext<T>,
  side: CombatSide,
): OwnOpponentContext<T> {
  const opponent = side === 'attacker' ? 'defender' : 'attacker'
  return {
    own: sided[side],
    opponent: sided[opponent],
  }
}

// Transform own/opponent back to sided
function toSided<T>(
  ownOpponent: OwnOpponentContext<T>,
  side: CombatSide,
): SidedContext<T> {
  if (side === 'attacker') {
    return {
      attacker: ownOpponent.own,
      defender: ownOpponent.opponent,
    }
  }
  return {
    attacker: ownOpponent.opponent,
    defender: ownOpponent.own,
  }
}

/** Config for a single ability - params overrides */
type AbilityConfig = Record<string, unknown>

/** Config for all abilities on one side */
type SideConfig = Record<string, AbilityConfig>

class AbilityInstanceImpl implements AbilityInstance {
  private ability: Ability
  private _params: Record<string, unknown>
  private _enabled: boolean

  constructor(ability: Ability, configParams?: AbilityConfig) {
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

  constructor(allAbilities: Ability[], config: SideConfig)
  constructor(abilities: Map<string, AbilityInstanceImpl>)
  constructor(
    arg: Ability[] | Map<string, AbilityInstanceImpl>,
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
  abilities: Ability[]
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

  /**
   * Run alternating resolution for abilities at given timing.
   * Loop stops when 2 consecutive skips occur.
   * Context is required for timings that need it (e.g., BEFORE_DICE_ROLL).
   * Each invoke is called at most once per timing phase unless multi: true.
   *
   * For sided context (attacker/defender), transforms to own/opponent for abilities,
   * then transforms back to attacker/defender and returns the modified context.
   */
  runAbilities<T extends AbilityTiming>(
    timing: T,
    state: CombatState,
    context?: TimingContextMap[T],
  ): TimingContextMap[T] {
    // Track which invokes have been called
    const calledInvokes = new Set<AbilityInvoke>()
    let consecutiveSkips = 0
    let currentSide: CombatSide = 'attacker'

    // Create a working copy of sided context that we'll transform for each ability
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workingContext: any = context

    while (consecutiveSkips < 2) {
      const resolved = this.tryResolveOneAbility(
        timing,
        currentSide,
        state,
        workingContext,
        calledInvokes,
      )

      if (resolved) {
        consecutiveSkips = 0
      } else {
        consecutiveSkips += 1
      }

      currentSide = currentSide === 'attacker' ? 'defender' : 'attacker'
    }

    return workingContext as TimingContextMap[T]
  }

  private tryResolveOneAbility<T extends AbilityTiming>(
    timing: T,
    side: CombatSide,
    state: CombatState,
    context: TimingContextMap[T] | undefined,
    calledInvokes: Set<AbilityInvoke>,
  ): boolean {
    const sideAbilities = this.getSideAbilities(side)
    const invokes = sideAbilities.getInvokesForTiming(timing)
    const ctx = this.buildContext(side, state)

    for (const { ability, invoke } of invokes) {
      if (!invoke.multi && calledInvokes.has(invoke)) {
        continue
      }

      const params = ability.params

      // Transform sided context to own/opponent for the ability
      let internalContext: InternalTimingContextMap[T] | undefined
      if (context !== undefined && isSidedContext(context)) {
        internalContext = toOwnOpponent(
          context,
          side,
        ) as InternalTimingContextMap[T]
      } else {
        internalContext = context as InternalTimingContextMap[T] | undefined
      }

      // Use type assertion since we know the invoke matches the timing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inv = invoke as any
      const canCall = inv.isCallable
        ? inv.isCallable(ctx, params, internalContext)
        : true
      if (canCall) {
        inv.call(ctx, params, internalContext)

        // Transform own/opponent back to sided and update the original context
        if (
          context !== undefined &&
          internalContext !== undefined &&
          isSidedContext(context)
        ) {
          const updated = toSided(
            internalContext as OwnOpponentContext<unknown>,
            side,
          )
          Object.assign(context, updated)
        }

        calledInvokes.add(invoke)
        return true
      }
    }
    return false
  }

  private buildContext(side: CombatSide, state: CombatState): AbilityContext {
    const opponentSide: CombatSide =
      side === 'attacker' ? 'defender' : 'attacker'

    return {
      own: state[side],
      opponent: state[opponentSide],
      state,
      abilities: {
        own: this.getSideAbilities(side),
        opponent: this.getSideAbilities(opponentSide),
      },
    }
  }
}
