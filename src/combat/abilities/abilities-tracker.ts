import { isDraft, produce } from 'immer'

import type { CombatSide, UnitType } from '@/types'

import { getDestroyedUnits, getOpponentSide } from '../state/side-state-ops'
import type { CombatStateData } from '../state/types'
import type { LogEntry } from '../types'
import { buildCallContext, buildReadContext } from './ability-api'
import { buildDiceApi, buildDiceReadApi } from './dice-api'
import {
  getAvailableAbilities,
  getUnitDefinitionAbilityKeys,
} from './get-available-abilities'
import type {
  Ability,
  AbilityInvoke,
  AbilityTiming,
  DestroyedUnit,
  DiceContext,
  DicePool,
  DiceReadContext,
  InternalTimingContextMap,
  OwnOpponentContext,
  SidedContext,
  TimingContextMap,
  TriggerEvent,
} from './types'

/** Source of an ability - either from config, a living unit, or a destroyed unit */
export type AbilitySource =
  | { type: 'config' }
  | { type: 'unit'; unitType: UnitType; unitIndex: number }
  | { type: 'destroyed'; unitType: UnitType; destroyedIndex: number }

// Type guard to detect sided objects (attacker/defender)
function isSidedContext<T>(ctx: unknown): ctx is SidedContext<T> {
  return (
    typeof ctx === 'object' &&
    ctx !== null &&
    'attacker' in ctx &&
    'defender' in ctx
  )
}

/** Stable reference to a unit across Immer produce boundaries */
interface UnitLocator {
  __unitLocator: true
  side: CombatSide
  unitType: UnitType
  unitIndex: number
}

function isUnitLocator(value: unknown): value is UnitLocator {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as UnitLocator).__unitLocator === true
  )
}

function resolveUnitLocator(state: CombatStateData, locator: UnitLocator) {
  return state[locator.side].units[locator.unitType]?.[locator.unitIndex]
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

/** Resolve abilities for a side: use override if present, otherwise derive from faction */
function resolveAbilities(
  state: CombatStateData,
  side: CombatSide,
): readonly Ability[] {
  return getAvailableAbilities(side, state[side].faction)
}

/** Get merged params for an ability */
function getAbilityMergedParams(
  ability: Ability,
  config?: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  return { ...ability.defaultParams, ...config?.[ability.key] }
}

/**
 * Adjust tracker indices after units are destroyed during trigger/AFTER_DESTROY.
 * When a unit is removed from an array, all subsequent indices shift down.
 * For each unit type where count decreased, clear tracked indices for that type
 * so remaining units can still be processed (isCallable guards re-invocation).
 */
function adjustTrackerForDestroyedUnits(
  tracker: InvocationTracker,
  oldState: CombatStateData,
  newState: CombatStateData,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    const sideTracker = tracker[side]
    const oldUnits = oldState[side].units
    const newUnits = newState[side].units

    for (const [type, oldArr] of Object.entries(oldUnits)) {
      if (!oldArr) continue
      const newArr = newUnits[type as UnitType]
      const newLength = newArr?.length ?? 0
      if (newLength >= oldArr.length) continue

      // Units were destroyed — clear tracked indices for this type
      // so shifted units aren't incorrectly skipped.
      // isCallable guards prevent genuine double-invocation.
      for (const [key, indices] of sideTracker.unitAbilities) {
        if (key.endsWith(`:${type}`)) {
          indices.clear()
        }
      }
    }
  }
}

/** Get invokes for a timing (or multiple timings) from ability definitions and unit abilities */
function getInvokesForTiming<T extends AbilityTiming>(
  timing: T | T[],
  side: CombatSide,
  state: CombatStateData,
  triggerSide?: CombatSide,
): TimingInvokeEntry[] {
  const timings = Array.isArray(timing) ? timing : [timing]
  const results: TimingInvokeEntry[] = []

  const { meta } = state.currentPhase

  const sideConfig = state.abilities[side]

  // 1. Collect unit abilities from units on field
  const unitAbilities = collectUnitAbilities(state, side)
  // Use faction definition keys (not just living units) so destroyed-unit abilities
  // are never collected as config abilities
  const unitAbilityKeys = getUnitDefinitionAbilityKeys(state[side].faction)
  for (const ua of unitAbilities) {
    unitAbilityKeys.add(ua.ability.key)
  }

  for (const { ability, unitType, unitIndex } of unitAbilities) {
    if (ability.context && ability.context !== state.combatMode) continue
    const params = getAbilityMergedParams(ability, sideConfig)

    for (const invoke of ability.invoke) {
      if (timings.includes(invoke.timing as T)) {
        if (invoke.context) {
          const allowed = Array.isArray(invoke.context)
            ? invoke.context
            : [invoke.context]
          if (!allowed.includes(meta)) continue
        }
        if (triggerSide && invoke.side) {
          if (invoke.side === 'OWN' && side !== triggerSide) continue
          if (invoke.side === 'OPPONENT' && side === triggerSide) continue
        }
        results.push({
          ability,
          invoke,
          params,
          source: { type: 'unit', unitType, unitIndex },
        })
      }
    }
  }

  // 2. Collect regular abilities from config (skip unit abilities — handled per-unit above)
  const availableAbilities = resolveAbilities(state, side)
  for (const ability of availableAbilities) {
    if (unitAbilityKeys.has(ability.key)) continue
    if (ability.context && ability.context !== state.combatMode) continue
    const params = getAbilityMergedParams(ability, sideConfig)

    for (const invoke of ability.invoke) {
      if (timings.includes(invoke.timing as T)) {
        if (invoke.context) {
          const allowed = Array.isArray(invoke.context)
            ? invoke.context
            : [invoke.context]
          if (!allowed.includes(meta)) continue
        }
        if (triggerSide && invoke.side) {
          if (invoke.side === 'OWN' && side !== triggerSide) continue
          if (invoke.side === 'OPPONENT' && side === triggerSide) continue
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

  return results
}

/** Get ability params for a side */
export function getAbilityParams(
  state: CombatStateData,
  side: CombatSide,
  key: string,
): Record<string, unknown> | undefined {
  const abilities = resolveAbilities(state, side)
  const ability = abilities.find(a => a.key === key)
  if (!ability) return undefined
  return { ...ability.defaultParams, ...state.abilities[side][key] }
}

/** Check if ability exists on a side */
export function hasAbility(
  state: CombatStateData,
  side: CombatSide,
  key: string,
): boolean {
  return resolveAbilities(state, side).some(a => a.key === key)
}

export interface RunAbilitiesResult<T extends AbilityTiming> {
  state: CombatStateData
  context: TimingContextMap[T]
  log: LogEntry[]
}

/** Invocation tracker for a single side's abilities */
interface SideInvocationTracker {
  configAbilities: Set<AbilityInvoke>
  unitAbilities: Map<string, Set<number>> // "timing:unitType" -> Set<unitIndex>
  destroyedAbilities: Map<string, Set<number>> // "timing:unitType" -> Set<destroyedIndex>
}

/** Invocation tracker per side */
type InvocationTracker = Record<CombatSide, SideInvocationTracker>

interface AbilityResult {
  state: CombatStateData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any
  log: LogEntry[]
}

export interface RunAbilitiesOptions {
  triggerSide?: CombatSide
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
  options?: RunAbilitiesOptions,
): RunAbilitiesResult<T> {
  const tracker: InvocationTracker = {
    attacker: {
      configAbilities: new Set(),
      unitAbilities: new Map(),
      destroyedAbilities: new Map(),
    },
    defender: {
      configAbilities: new Set(),
      unitAbilities: new Map(),
      destroyedAbilities: new Map(),
    },
  }
  let consecutiveSkips = 0
  let currentSide: CombatSide = options?.triggerSide ?? 'attacker'
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
      options?.triggerSide,
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
  triggerSide?: CombatSide,
): AbilityResult | null {
  const invokes = getInvokesForTiming(timing, side, state, triggerSide)

  // Collect AFTER_DESTROY invokes from destroyed units in context
  const timings = Array.isArray(timing) ? timing : [timing]
  if (
    timings.includes('AFTER_DESTROY' as T) &&
    context !== undefined &&
    isSidedContext(context)
  ) {
    const destroyedUnits = (context as SidedContext<DestroyedUnit[]>)[side]
    const { meta } = state.currentPhase
    for (let i = 0; i < destroyedUnits.length; i++) {
      const { type: unitType, unit } = destroyedUnits[i]
      if (!unit.ABILITIES) continue
      for (const ability of unit.ABILITIES) {
        if (ability.context && ability.context !== state.combatMode) continue
        for (const invoke of ability.invoke) {
          if (invoke.timing !== 'AFTER_DESTROY') continue
          if (invoke.context) {
            const allowed = Array.isArray(invoke.context)
              ? invoke.context
              : [invoke.context]
            if (!allowed.includes(meta)) continue
          }
          invokes.push({
            ability,
            invoke,
            params: ability.defaultParams ?? {},
            source: { type: 'destroyed', unitType, destroyedIndex: i },
          })
        }
      }
    }
  }

  const sideTracker = tracker[side]

  for (const { ability, invoke, params, source } of invokes) {
    // Check if already invoked
    if (source.type === 'config') {
      if (!invoke.multi && sideTracker.configAbilities.has(invoke)) {
        continue
      }
    } else if (source.type === 'destroyed') {
      // Destroyed unit ability - no unit-exists check needed
      const key = `destroyed:${invoke.timing}:${source.unitType}`
      const invokedIndices = sideTracker.destroyedAbilities.get(key)
      if (invokedIndices?.has(source.destroyedIndex)) {
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

    const unitSource =
      source.type === 'unit'
        ? { unitType: source.unitType, unitIndex: source.unitIndex }
        : undefined
    const readCtx = buildReadContext(side, state, unitSource)

    let canCall: boolean
    if (diceTiming && internalContext) {
      const rawDice = internalContext as OwnOpponentContext<DicePool>
      const diceReadCtx: DiceReadContext = {
        own: buildDiceReadApi(rawDice.own),
        opponent: buildDiceReadApi(rawDice.opponent),
      }
      canCall = inv.isCallable
        ? inv.isCallable(params, readCtx, diceReadCtx)
        : true
    } else {
      // Resolve unit locators to state references for isCallable
      const readableContext = isUnitLocator(internalContext)
        ? resolveUnitLocator(state, internalContext)
        : internalContext
      canCall = inv.isCallable
        ? inv.isCallable(params, readCtx, readableContext)
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

      // Collect trigger events emitted during produce
      const triggerEvents: TriggerEvent[] = []
      // Mutable ref so triggerCallback can access the current draft
      let draftRef: CombatStateData | null = null
      const triggerCallback = (event: TriggerEvent) => {
        let context = event.context
        if (isDraft(context) && draftRef) {
          // Convert draft unit reference to a stable locator
          // so it can be resolved in the next produce() call
          for (const checkSide of ['attacker', 'defender'] as const) {
            for (const [type, units] of Object.entries(
              draftRef[checkSide].units,
            )) {
              if (!units) continue
              const idx = units.indexOf(context)
              if (idx !== -1) {
                context = {
                  __unitLocator: true,
                  side: checkSide,
                  unitType: type as UnitType,
                  unitIndex: idx,
                } satisfies UnitLocator
                break
              }
            }
            if (isUnitLocator(context)) break
          }
        }
        triggerEvents.push({ ...event, context })
      }

      // Wrap call in Immer produce
      let resultState: CombatStateData
      if (diceTiming && internalContext) {
        const rawDice = internalContext as OwnOpponentContext<DicePool>
        const diceCallCtx: DiceContext = {
          own: buildDiceApi(rawDice.own),
          opponent: buildDiceApi(rawDice.opponent),
        }
        resultState = produce(state, draft => {
          draftRef = draft
          const callCtx = buildCallContext(
            side,
            draft,
            ability.key,
            logCallback,
            unitSource,
            triggerCallback,
          )
          inv.call(callCtx, params, diceCallCtx)
        })
        draftRef = null
        resultContext = {
          own: diceCallCtx.own.getAll(),
          opponent: diceCallCtx.opponent.getAll(),
        }
      } else {
        resultState = produce(state, draft => {
          draftRef = draft
          const callCtx = buildCallContext(
            side,
            draft,
            ability.key,
            logCallback,
            unitSource,
            triggerCallback,
          )
          // Resolve unit locators to draft references
          const callContext = isUnitLocator(internalContext)
            ? resolveUnitLocator(draft, internalContext)
            : internalContext
          const result = inv.call(callCtx, params, callContext)
          if (result !== undefined) resultContext = result
        })
        draftRef = null
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
      } else if (source.type === 'destroyed') {
        const key = `destroyed:${invoke.timing}:${source.unitType}`
        const invokedIndices =
          sideTracker.destroyedAbilities.get(key) ?? new Set()
        invokedIndices.add(source.destroyedIndex)
        sideTracker.destroyedAbilities.set(key, invokedIndices)
      } else {
        const key = `${invoke.timing}:${source.unitType}`
        const invokedIndices = sideTracker.unitAbilities.get(key) ?? new Set()
        invokedIndices.add(source.unitIndex)
        sideTracker.unitAbilities.set(key, invokedIndices)
      }

      // Process trigger events emitted during produce
      for (const event of triggerEvents) {
        const triggerResult = runAbilities(
          event.name,
          resultState,
          event.context,
          { triggerSide: event.side },
        )
        resultState = triggerResult.state
        log.push(...triggerResult.log)
      }

      // Trigger AFTER_DESTROY if units were destroyed by the ability (or trigger processing)
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

      // Adjust tracker indices when units were destroyed by triggers/AFTER_DESTROY
      adjustTrackerForDestroyedUnits(tracker, state, resultState)

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
