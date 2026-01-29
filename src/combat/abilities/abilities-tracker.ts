import { produce } from 'immer'

import type { DieValue, UnitType } from '@/types'

import { getDestroyedUnits, getOpponentSide } from '../state/side-state-ops'
import type {
  CombatSide,
  CombatStateData,
  SideAbilitiesConfig,
} from '../state/types'
import type { LogEntry } from '../types'
import { buildCallContext, buildReadContext } from './ability-api'
import { buildDiceApi, buildDiceReadApi } from './dice-api'
import type {
  Ability,
  AbilityInvoke,
  AbilityTiming,
  DiceContext,
  DiceReadContext,
  InternalTimingContextMap,
  OwnOpponentContext,
  SidedContext,
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

/** Get invokes for a timing (or multiple timings) from ability definitions and unit abilities */
function getInvokesForTiming<T extends AbilityTiming>(
  timing: T | T[],
  side: CombatSide,
  state: CombatStateData,
): TimingInvokeEntry[] {
  const timings = Array.isArray(timing) ? timing : [timing]
  const results: TimingInvokeEntry[] = []

  const { meta } = state.currentPhase

  // 1. Collect regular abilities from config
  const sideConfig = state.abilities[side]
  for (const ability of sideConfig.abilities as Ability[]) {
    const params = getAbilityMergedParams(ability, sideConfig)

    for (const invoke of ability.invoke) {
      if (timings.includes(invoke.timing as T)) {
        if (invoke.context) {
          const allowed = Array.isArray(invoke.context)
            ? invoke.context
            : [invoke.context]
          if (!allowed.includes(meta)) continue
        }
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
      if (timings.includes(invoke.timing as T)) {
        if (invoke.context) {
          const allowed = Array.isArray(invoke.context)
            ? invoke.context
            : [invoke.context]
          if (!allowed.includes(meta)) continue
        }
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

/** Get ability params for a side */
export function getAbilityParams(
  abilities: CombatStateData['abilities'],
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
  abilities: CombatStateData['abilities'],
  side: CombatSide,
  key: string,
): boolean {
  return (abilities[side].abilities as Ability[]).some(a => a.key === key)
}

export interface RunAbilitiesResult<T extends AbilityTiming> {
  state: CombatStateData
  context: TimingContextMap[T]
  log: LogEntry[]
}

/** Invocation tracker for a single side's abilities */
interface SideInvocationTracker {
  configAbilities: Set<AbilityInvoke>
  unitAbilities: Map<string, Set<number>> // "abilityKey:unitType" -> Set<unitIndex>
}

/** Invocation tracker per side */
type InvocationTracker = Record<CombatSide, SideInvocationTracker>

interface AbilityResult {
  state: CombatStateData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any
  log: LogEntry[]
}

/**
 * Run alternating resolution for abilities at given timing(s).
 * When multiple timings are provided, they share a single timing window
 * and abilities from all timings are resolved together.
 * Returns new state and modified context.
 */
export function runAbilities<T extends AbilityTiming>(
  timing: T | T[],
  state: CombatStateData,
  context?: TimingContextMap[T],
): RunAbilitiesResult<T> {
  const tracker: InvocationTracker = {
    attacker: { configAbilities: new Set(), unitAbilities: new Map() },
    defender: { configAbilities: new Set(), unitAbilities: new Map() },
  }
  let consecutiveSkips = 0
  let currentSide: CombatSide = 'attacker'
  let currentState = state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workingContext: any = context
  const accumulatedLog: LogEntry[] = []

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
      accumulatedLog.push(...result.log)
      consecutiveSkips = 0
    } else {
      consecutiveSkips += 1
    }

    currentSide = getOpponentSide(currentSide)
  }

  return {
    state: currentState,
    context: workingContext as TimingContextMap[T],
    log: accumulatedLog,
  }
}

function isDiceTiming(timing: AbilityTiming | AbilityTiming[]): boolean {
  const timings = Array.isArray(timing) ? timing : [timing]
  return timings.some(
    t => t === 'BEFORE_DICE_ROLL' || t === 'BEFORE_UNIT_ABILITY_ROLL',
  )
}

function tryResolveOneAbility<T extends AbilityTiming>(
  timing: T | T[],
  side: CombatSide,
  state: CombatStateData,
  context: TimingContextMap[T] | undefined,
  tracker: InvocationTracker,
): AbilityResult | null {
  const invokes = getInvokesForTiming(timing, side, state)
  const readCtx = buildReadContext(side, state)
  const sideTracker = tracker[side]

  for (const { ability, invoke, params, source } of invokes) {
    // Check if already invoked
    if (source.type === 'config') {
      if (!invoke.multi && sideTracker.configAbilities.has(invoke)) {
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
      const invokedIndices = sideTracker.unitAbilities.get(key)
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
    const diceTiming = isDiceTiming(timing)

    let canCall: boolean
    if (diceTiming && internalContext) {
      const rawDice = internalContext as OwnOpponentContext<DieValue[]>
      const diceReadCtx: DiceReadContext = {
        own: buildDiceReadApi(rawDice.own),
        opponent: buildDiceReadApi(rawDice.opponent),
      }
      canCall = inv.isCallable
        ? inv.isCallable(params, readCtx, diceReadCtx)
        : true
    } else {
      canCall = inv.isCallable
        ? inv.isCallable(params, readCtx, internalContext)
        : true
    }

    if (canCall) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resultContext: any

      // Extra data appended to the auto log entry via ctx.log() calls
      const logData: unknown[] = []
      const logCallback = (...data: unknown[]) => {
        logData.push(...data)
      }

      // Wrap call in Immer produce
      let resultState: CombatStateData
      if (diceTiming && internalContext) {
        const rawDice = internalContext as OwnOpponentContext<DieValue[]>
        const diceCallCtx: DiceContext = {
          own: buildDiceApi(rawDice.own),
          opponent: buildDiceApi(rawDice.opponent),
        }
        resultState = produce(state, draft => {
          const callCtx = buildCallContext(
            side,
            draft,
            ability.key,
            logCallback,
          )
          inv.call(callCtx, params, diceCallCtx)
        })
        resultContext = {
          own: diceCallCtx.own.getAll(),
          opponent: diceCallCtx.opponent.getAll(),
        }
      } else {
        resultState = produce(state, draft => {
          const callCtx = buildCallContext(
            side,
            draft,
            ability.key,
            logCallback,
          )
          const result = inv.call(callCtx, params, internalContext)
          if (result !== undefined) resultContext = result
        })
      }

      // Single log entry per ability: auto fields + any ctx.log() data
      const log: LogEntry[] = [
        [
          state.currentPhase.meta,
          `${invoke.timing}:${ability.key}`,
          side,
          ...logData,
        ],
      ]

      // Mark as invoked
      if (source.type === 'config') {
        sideTracker.configAbilities.add(invoke)
      } else {
        const key = `${invoke.timing}:${source.unitType}`
        const invokedIndices = sideTracker.unitAbilities.get(key) ?? new Set()
        invokedIndices.add(source.unitIndex)
        sideTracker.unitAbilities.set(key, invokedIndices)
      }

      // Trigger AFTER_DESTROY if units were destroyed by the ability
      // Skip if already resolving AFTER_DESTROY to prevent recursion
      const timingArray = Array.isArray(timing) ? timing : [timing]
      if (!timingArray.some(t => t === 'AFTER_DESTROY')) {
        const destroyedAttacker = getDestroyedUnits(
          state.attacker.units,
          resultState.attacker.units,
        )
        const destroyedDefender = getDestroyedUnits(
          state.defender.units,
          resultState.defender.units,
        )
        if (destroyedAttacker.length > 0 || destroyedDefender.length > 0) {
          const afterDestroy = runAbilities('AFTER_DESTROY', resultState, {
            attacker: destroyedAttacker,
            defender: destroyedDefender,
          })
          resultState = afterDestroy.state
          log.push(...afterDestroy.log)
        }
      }

      // Transform own/opponent context back to sided
      if (
        context !== undefined &&
        resultContext !== undefined &&
        isSidedContext(context)
      ) {
        resultContext = toSided(
          resultContext as OwnOpponentContext<unknown>,
          side,
        )
      }

      return {
        state: resultState,
        context: resultContext,
        log,
      }
    }
  }

  return null
}

export { collectUnitAbilities }
