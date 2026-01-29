import type { UnitType } from '@/types'

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

/** Source of an ability - either from config or from a unit */
export type AbilitySource =
  | { type: 'config' }
  | { type: 'unit'; unitType: UnitType; unitIndex: number }

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

interface UnitAbilityEntry {
  ability: Ability
  unitType: UnitType
  unitIndex: number
}

interface TimingInvokeEntry {
  ability: Ability
  invoke: AbilityInvoke
  params: Record<string, unknown>
  source: AbilitySource
}

/** Collect unit abilities from units on the field */
function collectUnitAbilities(
  state: CombatStateData,
  side: CombatSide,
): UnitAbilityEntry[] {
  const results: UnitAbilityEntry[] = []

  const sideState = state[side]
  const unitEntries = Object.entries(sideState.units) as Array<
    [UnitType, NonNullable<(typeof sideState.units)[UnitType]>]
  >

  for (const [unitType, units] of unitEntries) {
    if (!units) continue

    for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
      const unit = units[unitIndex]
      if (unit.ABILITIES) {
        for (const ability of unit.ABILITIES) {
          results.push({
            ability,
            unitType,
            unitIndex,
          })
        }
      }
    }
  }

  return results
}

/** Get merged params for an ability */
function getAbilityMergedParams(
  ability: Ability,
  sideConfig: SideAbilitiesConfig,
): Record<string, unknown> {
  return { ...ability.defaultParams, ...sideConfig.config?.[ability.key] }
}

/** Get invokes for a timing from ability definitions and unit abilities */
function getInvokesForTiming<T extends AbilityTiming>(
  timing: T,
  side: CombatSide,
  state: CombatStateData,
): TimingInvokeEntry[] {
  const results: TimingInvokeEntry[] = []

  // 1. Collect regular abilities from config
  const sideConfig = state.abilities[side]
  for (const ability of sideConfig.abilities as Ability[]) {
    const params = getAbilityMergedParams(ability, sideConfig)

    for (const invoke of ability.invoke) {
      if (invoke.timing === timing) {
        results.push({
          ability,
          invoke,
          params,
          source: { type: 'config' },
        })
      }
    }
  }

  // 2. Collect unit abilities from units on field
  const unitAbilities = collectUnitAbilities(state, side)
  for (const { ability, unitType, unitIndex } of unitAbilities) {
    for (const invoke of ability.invoke) {
      if (invoke.timing === timing) {
        results.push({
          ability,
          invoke,
          params: ability.defaultParams ?? {},
          source: { type: 'unit', unitType, unitIndex },
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

/** Invocation tracker for both config and unit abilities */
interface InvocationTracker {
  configAbilities: Set<AbilityInvoke>
  unitAbilities: Map<string, Set<number>> // "abilityKey:unitType" -> Set<unitIndex>
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
  const tracker: InvocationTracker = {
    configAbilities: new Set(),
    unitAbilities: new Map(),
  }
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
      tracker,
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
  tracker: InvocationTracker,
): StateChange | null {
  const invokes = getInvokesForTiming(timing, side, state)
  const readCtx = buildReadContext(side, state)

  for (const { invoke, params, source } of invokes) {
    // Check if already invoked
    if (source.type === 'config') {
      if (!invoke.multi && tracker.configAbilities.has(invoke)) {
        continue
      }
    } else {
      // Unit ability - check if unit still exists
      const currentUnits = state[side].units[source.unitType]
      if (!currentUnits || currentUnits.length <= source.unitIndex) {
        continue // Unit destroyed
      }

      // Check if this unit instance already invoked
      const key = `${invoke.timing}:${source.unitType}`
      const invokedIndices = tracker.unitAbilities.get(key)
      if (invokedIndices?.has(source.unitIndex)) {
        continue
      }
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

      // Mark as invoked
      if (source.type === 'config') {
        tracker.configAbilities.add(invoke)
      } else {
        const key = `${invoke.timing}:${source.unitType}`
        const invokedIndices = tracker.unitAbilities.get(key) ?? new Set()
        invokedIndices.add(source.unitIndex)
        tracker.unitAbilities.set(key, invokedIndices)
      }

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

export { collectUnitAbilities }
