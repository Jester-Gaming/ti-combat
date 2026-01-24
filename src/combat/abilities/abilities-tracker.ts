import { getOpponentSide } from '../state/side-state-ops'
import type {
  AbilitiesConfig,
  CombatSide,
  CombatStateData,
  SideAbilitiesConfig,
} from '../state/types'
import type {
  Ability,
  AbilityInvoke,
  AbilityReadContext,
  AbilityTiming,
  InternalTimingContextMap,
  OwnOpponentContext,
  SidedContext,
  StateChange,
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
  const opponent = getOpponentSide(side)
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

/** Get merged params for an ability */
function getAbilityMergedParams(
  ability: Ability,
  sideConfig: SideAbilitiesConfig,
): Record<string, unknown> {
  return { ...ability.defaultParams, ...sideConfig.config?.[ability.key] }
}

/** Get invokes for a timing from ability definitions */
function getInvokesForTiming<T extends AbilityTiming>(
  timing: T,
  sideConfig: SideAbilitiesConfig,
): Array<{
  ability: Ability
  invoke: AbilityInvoke
  params: Record<string, unknown>
}> {
  const results: Array<{
    ability: Ability
    invoke: AbilityInvoke
    params: Record<string, unknown>
  }> = []

  for (const ability of sideConfig.abilities as Ability[]) {
    const params = getAbilityMergedParams(ability, sideConfig)

    for (const invoke of ability.invoke) {
      if (invoke.timing === timing) {
        results.push({
          ability,
          invoke,
          params,
        })
      }
    }
  }

  return results
}

/** Build read context for ability execution */
function buildReadContext(
  side: CombatSide,
  state: CombatStateData,
): AbilityReadContext {
  const opponentSide = getOpponentSide(side)
  return {
    own: state[side],
    opponent: state[opponentSide],
    state,
    side,
  }
}

/** Get ability params for a side */
export function getAbilityParams(
  abilities: AbilitiesConfig,
  side: CombatSide,
  key: string,
): Record<string, unknown> | undefined {
  const sideConfig = abilities[side]
  const ability = (sideConfig.abilities as Ability[]).find(a => a.key === key)
  if (!ability) return undefined
  return { ...ability.defaultParams, ...sideConfig.config?.[key] }
}

/** Check if ability exists on a side */
export function hasAbility(
  abilities: AbilitiesConfig,
  side: CombatSide,
  key: string,
): boolean {
  return (abilities[side].abilities as Ability[]).some(a => a.key === key)
}

export interface RunAbilitiesResult<T extends AbilityTiming> {
  state: CombatStateData
  context: TimingContextMap[T]
}

/**
 * Run alternating resolution for abilities at given timing.
 * Returns new state and modified context.
 */
export function runAbilities<T extends AbilityTiming>(
  timing: T,
  state: CombatStateData,
  context?: TimingContextMap[T],
): RunAbilitiesResult<T> {
  const calledInvokes = new Set<AbilityInvoke>()
  let consecutiveSkips = 0
  let currentSide: CombatSide = 'attacker'
  let currentState = state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workingContext: any = context

  while (consecutiveSkips < 2) {
    const result = tryResolveOneAbility(
      timing,
      currentSide,
      currentState,
      workingContext,
      calledInvokes,
    )

    if (result) {
      currentState = result.state
      if (result.context !== undefined) {
        workingContext = result.context
      }
      consecutiveSkips = 0
    } else {
      consecutiveSkips += 1
    }

    currentSide = getOpponentSide(currentSide)
  }

  return {
    state: currentState,
    context: workingContext as TimingContextMap[T],
  }
}

function tryResolveOneAbility<T extends AbilityTiming>(
  timing: T,
  side: CombatSide,
  state: CombatStateData,
  context: TimingContextMap[T] | undefined,
  calledInvokes: Set<AbilityInvoke>,
): StateChange | null {
  const sideConfig = state.abilities[side]
  const invokes = getInvokesForTiming(timing, sideConfig)
  const readCtx = buildReadContext(side, state)

  for (const { invoke, params } of invokes) {
    if (!invoke.multi && calledInvokes.has(invoke)) {
      continue
    }

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
      ? inv.isCallable(readCtx, params, internalContext)
      : true

    if (canCall) {
      const result: StateChange = inv.call(readCtx, params, internalContext)
      calledInvokes.add(invoke)

      // Transform own/opponent context back to sided
      let resultContext = result.context
      if (
        context !== undefined &&
        result.context !== undefined &&
        isSidedContext(context)
      ) {
        resultContext = toSided(
          result.context as OwnOpponentContext<unknown>,
          side,
        )
      }

      return {
        state: result.state,
        context: resultContext,
      }
    }
  }

  return null
}
