import { isDraft, produce } from 'immer'

import { GROUND_FORCES, SHIPS, UNIT_PRICE } from '@/constants/units'
import type { CombatSide, FactionKey, UnitType } from '@/types'

import { getOpponentSide } from '../combat-side-state/combat-side-state'
import { getDestroyedUnits } from '../combat-side-state/utils/get-destroyed-units'
import { CombatState } from '../combat-state/combat-state'
import type { AbilitiesConfig, CombatStateData } from '../combat-state/types'
import { Logger } from '../logger'
import type { LogEntry } from '../types'
import { makeVariantId, parseVariantId } from '../utils/unit-variant'
import { buildCallContext, buildReadContext } from './api/ability-api'
import { buildDiceApi, buildDiceReadApi } from './api/dice-api'
import { extractDefaults, extractSyncSources } from './declare-param'
import {
  getAvailableAbilities,
  getUnitDefinitionAbilityKeys,
} from './get-available-abilities'
import type {
  Ability,
  AbilityInvoke,
  AbilityTiming,
  DeclaredSubtype,
  DestroyedUnit,
  DiceContext,
  DicePool,
  DiceReadContext,
  InternalTimingContextMap,
  OwnOpponentContext,
  ParamChange,
  SidedContext,
  SyncSourceConfig,
  TimingContextMap,
  TriggerEvent,
} from './types'

type SideConfig = Record<string, Record<string, unknown>>

// ── Ability execution engine (module-private helpers) ────────────────────

/** Source of an ability - either from config, a living unit, or a destroyed unit */
type AbilitySource =
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

/** Get merged params for an ability */
function getAbilityMergedParams(
  ability: Ability,
  config?: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  return { ...extractDefaults(ability), ...config?.[ability.key] }
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

/** Resolve SETTINGS ability defaults + config into merged settings and subtypes */
function resolveSettings(
  abilities: Ability[],
  config: SideConfig,
): { settings: Record<string, unknown>; subtypes: DeclaredSubtype[] } {
  const settingsAbility = abilities.find(a => a.key === 'SETTINGS')
  const settings = {
    ...(settingsAbility ? extractDefaults(settingsAbility) : undefined),
    ...config['SETTINGS'],
  }
  const subtypes = (settings.subtypes ?? []) as DeclaredSubtype[]
  return { settings, subtypes }
}

function isDiceTiming(timing: AbilityTiming | AbilityTiming[]): boolean {
  const timings = Array.isArray(timing) ? timing : [timing]
  return timings.some(
    t => t === 'BEFORE_DICE_ROLL' || t === 'BEFORE_UNIT_ABILITY_ROLL',
  )
}

// ── Sync-source reconciliation helpers ────────────────────────────────────

function sortByPrice(types: UnitType[], direction: 'asc' | 'desc'): UnitType[] {
  const sorted = [...types].sort((a, b) => UNIT_PRICE[a] - UNIT_PRICE[b])
  return direction === 'desc' ? sorted.reverse() : sorted
}

function expandWithSubtypes(
  sortedTypes: UnitType[],
  subtypes: DeclaredSubtype[],
): string[] {
  const simpleByType = new Map<UnitType, DeclaredSubtype[]>()
  const compound: DeclaredSubtype[] = []

  for (const st of subtypes) {
    const { type, subtypes: parentSubs } = parseVariantId(st.unitType)
    if (parentSubs.length === 0) {
      const list = simpleByType.get(type)
      if (list) list.push(st)
      else simpleByType.set(type, [st])
    } else {
      compound.push(st)
    }
  }

  const result: string[] = []
  const seen = new Set<string>()
  for (const unitType of sortedTypes) {
    if (!seen.has(unitType)) {
      result.push(unitType)
      seen.add(unitType)
    }
    const subs = simpleByType.get(unitType)
    if (subs) {
      for (const sub of subs) {
        const variantId = makeVariantId(sub.unitType, [sub.name])
        if (!seen.has(variantId)) {
          result.push(variantId)
          seen.add(variantId)
        }
      }
    }
  }

  for (const sub of compound) {
    if (!seen.has(sub.unitType)) continue
    const { type, subtypes: parentSubs } = parseVariantId(sub.unitType)
    const variantId = makeVariantId(type, [...parentSubs, sub.name])
    if (!seen.has(variantId)) {
      const parentIndex = result.indexOf(sub.unitType)
      result.splice(parentIndex + 1, 0, variantId)
      seen.add(variantId)
    }
  }

  return result
}

function buildValidList(
  config: SyncSourceConfig,
  ownSettings: Record<string, unknown>,
  opponentSettings: Record<string, unknown>,
  ownSubtypes: DeclaredSubtype[],
  opponentSubtypes: DeclaredSubtype[],
): string[] {
  const settings = config.side === 'own' ? ownSettings : opponentSettings
  const subtypes = config.side === 'own' ? ownSubtypes : opponentSubtypes
  const group = (settings[config.group] as UnitType[]) ?? []
  const sorted = sortByPrice(group, config.sort)
  return expandWithSubtypes(sorted, subtypes)
}

function reconcileArrayParam(current: string[], validList: string[]): string[] {
  const validSet = new Set(validList)
  const currentSet = new Set(current)

  const kept = current.filter(item => validSet.has(item))
  const newItems = validList.filter(item => !currentSet.has(item))

  if (newItems.length === 0) return kept

  const result = [...kept]
  for (const newItem of newItems) {
    const validIndex = validList.indexOf(newItem)
    let insertAt = 0
    for (let i = 0; i < result.length; i++) {
      const resultItemValidIndex = validList.indexOf(result[i])
      if (resultItemValidIndex < validIndex) {
        insertAt = i + 1
      }
    }
    result.splice(insertAt, 0, newItem)
  }

  return result
}

function reconcileStringParam(current: string, validList: string[]): string {
  if (validList.includes(current)) return current
  return validList[0] ?? current
}

// ── Tracker types ────────────────────────────────────────────────────────

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
}

export interface RunAbilitiesOptions {
  triggerSide?: CombatSide
}

// ── Main class ───────────────────────────────────────────────────────────

/**
 * Mutable controller for ability params.
 *
 * Has a direct bidirectional link with CombatState — reads and writes
 * ability config through CombatState.data.abilities. During ability
 * execution, updates CombatState.data directly after each Immer produce.
 */
export class AbilitiesParams {
  private _combatState: CombatState
  private _abilities: Record<CombatSide, Ability[]>

  private static loadAbilities(
    attackerFaction: FactionKey,
    defenderFaction: FactionKey,
  ): Record<CombatSide, Ability[]> {
    return {
      attacker: getAvailableAbilities('attacker', attackerFaction),
      defender: getAvailableAbilities('defender', defenderFaction),
    }
  }

  private get state(): CombatStateData {
    return this._combatState.data
  }

  // ── Read accessors ──────────────────────────────────────────────────

  get attackerFaction(): FactionKey {
    return this.state.attacker.faction
  }

  get defenderFaction(): FactionKey {
    return this.state.defender.faction
  }

  get config(): AbilitiesConfig {
    return this.state.abilities
  }

  getAbilities(side: CombatSide): Ability[] {
    return this._abilities[side]
  }

  // ── Constructor: takes CombatState ────────────────────────────────

  constructor(combatState: CombatState) {
    this._combatState = combatState
    this._abilities = AbilitiesParams.loadAbilities(
      combatState.data.attacker.faction,
      combatState.data.defender.faction,
    )

    this.initializeDefaults()
    this.reconcile()
  }

  // ── Deserialize: from existing config data ──────────────────────────

  /**
   * Create from existing config data (engine initialization path).
   *
   * Unlike the constructor (UI path), group additions are NOT applied
   * here — they come from runtime invokes (START_OF_COMBAT, etc.).
   * Only SETTINGS base groups are reset to defaults and derived values
   * are recomputed. Consumer params are trusted as-is from config.
   */
  static fromConfig(combatState: CombatState): AbilitiesParams {
    const instance = Object.create(AbilitiesParams.prototype) as AbilitiesParams
    instance._combatState = combatState
    instance._abilities = AbilitiesParams.loadAbilities(
      combatState.data.attacker.faction,
      combatState.data.defender.faction,
    )

    instance.reconcile({ applyGroupAdditions: false, preserveUserParams: true })

    return instance
  }

  /**
   * Lightweight factory — creates instance without cloning or reconciliation.
   * Used for read-only contexts where we only need ability lookups and
   * default merging (CombatState.fromData fallback, etc.).
   */
  static wrap(combatState: CombatState): AbilitiesParams {
    const instance = Object.create(AbilitiesParams.prototype) as AbilitiesParams
    instance._combatState = combatState
    instance._abilities = AbilitiesParams.loadAbilities(
      combatState.data.attacker.faction,
      combatState.data.defender.faction,
    )
    return instance
  }

  /** Collect unit abilities from units on the field */
  static collectUnitAbilities(
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

  // ── Mutations ───────────────────────────────────────────────────────

  setFaction(side: CombatSide, faction: FactionKey): void {
    // Update faction in CombatState's data
    this.state[side].faction = faction
    this.reconcileFaction(side, faction)
  }

  /**
   * Reconcile abilities after a faction change: reload available abilities,
   * rebuild config for the side, prune removed abilities, run reconcile().
   */
  reconcileFaction(side: CombatSide, faction: FactionKey): void {
    this._abilities[side] = getAvailableAbilities(side, faction)

    // Rebuild side config: keep existing params for surviving abilities,
    // initialize defaults for new ones
    const oldSideConfig = this.config[side]
    const newSideConfig: SideConfig = {}

    for (const ability of this._abilities[side]) {
      const defaults = extractDefaults(ability)
      if (oldSideConfig[ability.key]) {
        newSideConfig[ability.key] = { ...oldSideConfig[ability.key] }
      } else if (defaults) {
        newSideConfig[ability.key] = { ...defaults }
      }
    }

    this.config[side] = newSideConfig

    this.reconcile()
  }

  setParam(
    side: CombatSide,
    abilityKey: string,
    params: Record<string, unknown>,
  ): void {
    this.config[side] = {
      ...this.config[side],
      [abilityKey]: params,
    }

    const ability = this._abilities[side].find(a => a.key === abilityKey)
    if (ability?.declareParamChange) {
      this.reconcile()
    }
  }

  // ── Ability execution engine ──────────────────────────────────────

  /**
   * Run alternating resolution for abilities at given timing(s).
   * When multiple timings are provided, they share a single timing window
   * and abilities from all timings are resolved together.
   * Returns new state and modified context.
   */
  runAbilities<T extends AbilityTiming>(
    timing: T | T[],
    state: CombatStateData,
    context?: TimingContextMap[T],
    options?: RunAbilitiesOptions,
    logger?: Logger,
  ): RunAbilitiesResult<T> {
    const activeLogger = logger ?? Logger.create()
    const startIndex = activeLogger.entries.length

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
    // Point CombatState at the current state data
    this._combatState.data = state

    let consecutiveSkips = 0
    let currentSide: CombatSide = options?.triggerSide ?? 'attacker'
    let currentState = state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let workingContext: any = context

    // Snapshot SETTINGS before abilities run to detect changes
    const settingsBefore = {
      attacker: state.abilities.attacker['SETTINGS'],
      defender: state.abilities.defender['SETTINGS'],
    }

    while (consecutiveSkips < 2) {
      const result = this.tryResolveOne(
        timing,
        currentSide,
        currentState,
        workingContext,
        tracker,
        options?.triggerSide,
        activeLogger,
      )

      if (result) {
        currentState = result.state
        this._combatState.data = currentState
        if (result.context !== undefined) {
          workingContext = result.context
        }
        consecutiveSkips = 0
      } else {
        consecutiveSkips += 1
      }

      currentSide = getOpponentSide(currentSide)
    }

    // Reconcile consumer ability params when SETTINGS changed during this timing
    const settingsAfter = {
      attacker: currentState.abilities.attacker['SETTINGS'],
      defender: currentState.abilities.defender['SETTINGS'],
    }
    if (
      settingsAfter.attacker !== settingsBefore.attacker ||
      settingsAfter.defender !== settingsBefore.defender
    ) {
      this.reconcile({ resetBaseGroups: false })
      currentState = this._combatState.data
    }

    return {
      state: currentState,
      context: workingContext as TimingContextMap[T],
      log: activeLogger.entries.slice(startIndex) as LogEntry[],
    }
  }

  // ── Private execution engine methods ──────────────────────────────

  private tryResolveOne<T extends AbilityTiming>(
    timing: T | T[],
    side: CombatSide,
    state: CombatStateData,
    context: TimingContextMap[T] | undefined,
    tracker: InvocationTracker,
    triggerSide?: CombatSide,
    logger?: Logger,
  ): AbilityResult | null {
    const invokes = this.getInvokesForTiming(timing, side, state, triggerSide)

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
              params: extractDefaults(ability) ?? {},
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

        // Single structured log entry per ability
        if (logger) {
          const abilityLogger = logger
            .child(invoke.timing)
            .child(ability.key)
            .forSide(side)
          if (logData.length > 0) {
            abilityLogger.log(...logData)
          } else {
            abilityLogger.log()
          }
        }

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
          const triggerResult = this.runAbilities(
            event.name,
            resultState,
            event.context,
            { triggerSide: event.side },
            logger,
          )
          resultState = triggerResult.state
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
            const afterDestroy = this.runAbilities(
              'AFTER_DESTROY',
              resultState,
              {
                attacker: destroyedAttacker,
                defender: destroyedDefender,
              },
              undefined,
              logger,
            )
            resultState = afterDestroy.state
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
        }
      }
    }

    return null
  }

  /** Get invokes for a timing (or multiple timings) from ability definitions and unit abilities */
  private getInvokesForTiming<T extends AbilityTiming>(
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
    const unitAbilities = AbilitiesParams.collectUnitAbilities(state, side)
    // Use faction definition keys (not just living units) so destroyed-unit abilities
    // are never collected as config abilities
    const unitAbilityKeys = getUnitDefinitionAbilityKeys(state[side].faction)
    for (const ua of unitAbilities) {
      unitAbilityKeys.add(ua.ability.key)
    }

    const collectInvokes = (ability: Ability, source: AbilitySource): void => {
      if (ability.context && ability.context !== state.combatMode) return
      const mergedParams = getAbilityMergedParams(ability, sideConfig)

      for (const invoke of ability.invoke) {
        if (!timings.includes(invoke.timing as T)) continue
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
        results.push({ ability, invoke, params: mergedParams, source })
      }
    }

    for (const { ability, unitType, unitIndex } of unitAbilities) {
      collectInvokes(ability, { type: 'unit', unitType, unitIndex })
    }

    // 2. Collect regular abilities from config (skip unit abilities — handled per-unit above)
    const availableAbilities = this.getAbilities(side)
    for (const ability of availableAbilities) {
      if (unitAbilityKeys.has(ability.key)) continue
      collectInvokes(ability, { type: 'config' })
    }

    return results
  }

  // ── Private core logic ──────────────────────────────────────────────

  /**
   * Initialize defaults for abilities that declare params but don't
   * yet have entries in the config.
   */
  private initializeDefaults(): void {
    const config: AbilitiesConfig = {
      attacker: { ...this.config.attacker },
      defender: { ...this.config.defender },
    }

    for (const side of ['attacker', 'defender'] as const) {
      for (const ability of this._abilities[side]) {
        const defaults = extractDefaults(ability)
        if (!config[side][ability.key] && defaults) {
          config[side][ability.key] = { ...defaults }
        }
      }
    }

    this._combatState.data = { ...this._combatState.data, abilities: config }
  }

  /**
   * Unified reconciliation pipeline.
   *
   * @param resetBaseGroups    Reset ships/groundForces/subtypes to defaults
   *   and recompute from declareParamChange. (default: true)
   * @param applyGroupAdditions  Apply non-subtype group additions from
   *   declareParamChange (e.g. adding MECH to ships). Only relevant when
   *   resetBaseGroups is true. (default: true)
   * @param preserveUserParams   Merge back user-provided consumer params
   *   after sync — used by the engine init path. (default: false)
   */
  private reconcile(
    options: {
      resetBaseGroups?: boolean
      applyGroupAdditions?: boolean
      preserveUserParams?: boolean
    } = {},
  ): void {
    const {
      resetBaseGroups = true,
      applyGroupAdditions = true,
      preserveUserParams = false,
    } = options

    const config: AbilitiesConfig = {
      attacker: { ...this.config.attacker },
      defender: { ...this.config.defender },
    }

    if (resetBaseGroups) {
      for (const side of ['attacker', 'defender'] as const) {
        const abilities = this._abilities[side]

        if (!config[side]['SETTINGS']) config[side]['SETTINGS'] = {}
        const settings = config[side]['SETTINGS']

        settings.ships = [...SHIPS]
        settings.groundForces = [...GROUND_FORCES]
        settings.subtypes = []

        const changes = this.collectParamChanges(abilities, config[side])
        for (const change of changes) {
          if (change.key === 'subtypes') {
            ;(settings.subtypes as DeclaredSubtype[]).push(
              change.value as DeclaredSubtype,
            )
          } else if (applyGroupAdditions) {
            const group = settings[change.key] as UnitType[]
            if (group && !group.includes(change.value as UnitType)) {
              group.push(change.value as UnitType)
            }
          }
        }
      }
    }

    this.ensureConsumerDefaults(config)
    this.reconcileSyncAll(config)

    if (preserveUserParams) {
      for (const side of ['attacker', 'defender'] as const) {
        for (const ability of this._abilities[side]) {
          if (ability.key === 'SETTINGS') continue
          const userParams = this.config[side][ability.key]
          if (!userParams) continue
          const synced = config[side][ability.key]
          if (!synced) continue
          config[side][ability.key] = { ...synced, ...userParams }
        }
      }
    }

    this._combatState.data = { ...this._combatState.data, abilities: config }
  }

  /**
   * Ensure consumer abilities (those with sync-sources) have params
   * initialized from defaults. Also initializes SETTINGS defaults.
   */
  private ensureConsumerDefaults(config: AbilitiesConfig): void {
    for (const side of ['attacker', 'defender'] as const) {
      for (const ability of this._abilities[side]) {
        if (!extractSyncSources(ability)) continue
        const defaults = extractDefaults(ability)
        if (defaults) {
          config[side][ability.key] = {
            ...defaults,
            ...config[side][ability.key],
          }
        }
      }
    }
  }

  /**
   * Shared sync logic: reconcile SETTINGS computed params for both sides,
   * then reconcile consumer params with cross-side access.
   */
  private reconcileSyncAll(config: AbilitiesConfig): void {
    // Pass 1: Reconcile SETTINGS computed params for both sides
    // Must happen before consumers so cross-side sources
    // (e.g. Raid Formation reading opponent's nonFighterShips) see
    // computed values.
    for (const side of ['attacker', 'defender'] as const) {
      const sideAbilities = this._abilities[side]
      const { settings, subtypes } = resolveSettings(
        sideAbilities,
        config[side],
      )
      this.reconcileSyncSources(
        sideAbilities.filter(a => a.key === 'SETTINGS'),
        config[side],
        settings,
        settings,
        subtypes,
        subtypes,
      )
    }

    // Pass 2: Reconcile consumer abilities with fresh cross-side settings
    for (const side of ['attacker', 'defender'] as const) {
      const oppSide = side === 'attacker' ? 'defender' : 'attacker'
      const sideAbilities = this._abilities[side]
      const { settings: ownSettings, subtypes: ownSubtypes } = resolveSettings(
        sideAbilities,
        config[side],
      )
      const { settings: oppSettings, subtypes: oppSubtypes } = resolveSettings(
        this._abilities[oppSide],
        config[oppSide],
      )
      this.reconcileSyncSources(
        sideAbilities.filter(a => a.key !== 'SETTINGS'),
        config[side],
        ownSettings,
        oppSettings,
        ownSubtypes,
        oppSubtypes,
      )
    }
  }

  // ── Inlined utils ──────────────────────────────────────────────────

  private collectParamChanges(
    abilities: readonly Ability[],
    params: Record<string, Record<string, unknown>>,
  ): ParamChange[] {
    const result: ParamChange[] = []

    for (const ability of abilities) {
      if (!ability.declareParamChange) continue

      const abilityParams = {
        ...extractDefaults(ability),
        ...params[ability.key],
      }

      if (ability.headerUI) {
        const headerValue = abilityParams[ability.headerUI]
        if (!headerValue) continue
      }

      const declared = ability.declareParamChange(abilityParams)
      result.push(...declared)
    }

    return result
  }

  private reconcileSyncSources(
    abilities: readonly Ability[],
    params: Record<string, Record<string, unknown>>,
    ownSettings: Record<string, unknown>,
    opponentSettings: Record<string, unknown>,
    ownSubtypes: DeclaredSubtype[],
    opponentSubtypes: DeclaredSubtype[],
  ): void {
    for (const ability of abilities) {
      const syncSources = extractSyncSources(ability)
      if (!syncSources) continue

      let abilityParams = params[ability.key]
      if (!abilityParams) continue

      if (Object.isFrozen(abilityParams)) {
        abilityParams = { ...abilityParams }
        params[ability.key] = abilityParams
      }

      for (const config of syncSources) {
        if (config.compute) {
          const settings =
            config.side === 'own' ? ownSettings : opponentSettings
          abilityParams[config.key] = config.compute(settings[config.group])
          continue
        }

        const validList = buildValidList(
          config,
          ownSettings,
          opponentSettings,
          ownSubtypes,
          opponentSubtypes,
        )

        const currentValue = abilityParams[config.key]

        if (Array.isArray(currentValue)) {
          abilityParams[config.key] = reconcileArrayParam(
            currentValue as string[],
            validList,
          )
        } else if (typeof currentValue === 'string') {
          abilityParams[config.key] = reconcileStringParam(
            currentValue,
            validList,
          )
        }
      }
    }
  }
}
