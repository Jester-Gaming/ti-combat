import { create } from 'mutative'

import { GROUND_FORCES, SHIPS, UNIT_PRICE } from '@/constants/units'
import type { CombatSide, FactionKey, UnitBaseType } from '@/types'

import { TIMING_GROUPS } from '../../data/abilities/general/ability-order'
import { getOpponentSide } from '../combat-side-state/combat-side-state'
import { CombatState } from '../combat-state/combat-state'
import type {
  AbilitiesConfig,
  CombatStateData,
  SideStateData,
} from '../combat-state/types'
import { Logger } from '../logger'
import type { LogEntry } from '../types'
import {
  resolveUnitStats,
  toGlobalIndex,
  totalCountForType,
} from '../utils/compact-units'
import { makeVariantId, parseVariantId } from '../utils/unit-variant'
import { AbilityContext } from './api/ability-api'
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

/** Source of an ability - either from config or a unit */
type AbilitySource =
  | { type: 'config' }
  | { type: 'unit'; unitType: UnitBaseType; unitIndex: number }

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
  unitType: UnitBaseType
  unitIndex: number
}

const EMPTY_LOG: LogEntry[] = []

interface TimingInvokeEntry {
  ability: Ability
  invoke: AbilityInvoke
  params: Record<string, unknown>
  source: AbilitySource
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

    // Compare counts per variant key
    for (const key of Object.keys(oldUnits)) {
      const oldCount = oldUnits[key] ?? 0
      const newCount = newUnits[key] ?? 0
      if (newCount >= oldCount) continue

      // Units were destroyed — clear tracked indices for this type
      const { type } = parseVariantId(key)
      const typeSegment = `:${type}:`
      for (const [trackerKey, indices] of sideTracker.unitAbilities) {
        if (trackerKey.includes(typeSegment)) {
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

/** Decrement `uses` in ability config after a successful invocation */
function decrementUses(
  draft: CombatStateData,
  side: CombatSide,
  abilityKey: string,
  params: Record<string, unknown>,
  abilitiesParams?: AbilitiesParams,
): void {
  if (
    'uses' in params &&
    typeof params.uses === 'number' &&
    isFinite(params.uses)
  ) {
    const config = draft.abilities[side][abilityKey]
    if (config && typeof config.uses === 'number') {
      config.uses -= 1
    } else if (config) {
      // Config exists but uses not set — initialize from params default
      config.uses = params.uses - 1
    } else {
      draft.abilities[side][abilityKey] = { uses: params.uses - 1 }
    }
    if (abilitiesParams) {
      abilitiesParams.syncInvokesForKey(side, abilityKey, draft)
    }
  }
}

function isDiceTiming(timing: AbilityTiming | AbilityTiming[]): boolean {
  const timings = Array.isArray(timing) ? timing : [timing]
  return timings.some(
    t => t === 'BEFORE_DICE_ROLL' || t === 'BEFORE_UNIT_ABILITY_ROLL',
  )
}

// ── Sync-source reconciliation helpers ────────────────────────────────────

function sortByPrice(
  types: UnitBaseType[],
  direction: 'asc' | 'desc',
): UnitBaseType[] {
  const sorted = [...types].sort((a, b) => UNIT_PRICE[a] - UNIT_PRICE[b])
  return direction === 'desc' ? sorted.reverse() : sorted
}

function expandWithSubtypes(
  sortedTypes: UnitBaseType[],
  subtypes: DeclaredSubtype[],
): string[] {
  const simpleByType = new Map<UnitBaseType, DeclaredSubtype[]>()
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
  const group = (settings[config.group] as UnitBaseType[]) ?? []
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
  unitAbilities: Map<string, Set<number>> // "timing:unitType:abilityKey" -> Set<unitIndex>
}

/** Invocation tracker per side */
type InvocationTracker = Record<CombatSide, SideInvocationTracker>

interface AbilityResult {
  state: CombatStateData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any
  unitsChanged?: boolean
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
export interface InvokeCollections {
  attacker: Map<AbilityTiming, TimingInvokeEntry[]>
  defender: Map<AbilityTiming, TimingInvokeEntry[]>
}

export function cloneInvokes(invokes: InvokeCollections): InvokeCollections {
  return {
    attacker: new Map(Array.from(invokes.attacker, ([k, v]) => [k, [...v]])),
    defender: new Map(Array.from(invokes.defender, ([k, v]) => [k, [...v]])),
  }
}

export class AbilitiesParams {
  private _combatState: CombatState
  private _abilities: Record<CombatSide, Ability[]>
  private _attackerCtx!: AbilityContext
  private _defenderCtx!: AbilityContext

  /** Destroyed units collected at source by destroyUnit */
  _destroyed: {
    attacker: Record<string, number>
    defender: Record<string, number>
  } = {
    attacker: {},
    defender: {},
  }
  /** Cheap "any destruction?" counter — incremented by destroyUnit */
  _destroyCount = 0

  /** Deferred invoke registrations — flushed after Immer produce completes */
  _pendingUnitInvokes: {
    side: CombatSide
    variantKey: string
    startSubIndex: number
    count: number
  }[] = []

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

  get combatState(): CombatState {
    return this._combatState
  }

  setCombatState(cs: CombatState): void {
    this._combatState = cs
    this._destroyed = { attacker: {}, defender: {} }
    this._destroyCount = 0
    this._pendingUnitInvokes = []
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

  context(side: CombatSide): AbilityContext {
    return side === 'attacker' ? this._attackerCtx : this._defenderCtx
  }

  getAbilityKeysForTiming(
    side: CombatSide,
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[] {
    const timings = Array.isArray(timing) ? timing : [timing]
    const sideMap = this._combatState._invokes[side]
    const seen = new Set<string>()
    const results: { key: string; name: string }[] = []
    for (const t of timings) {
      const entries = sideMap.get(t)
      if (!entries) continue
      for (const entry of entries) {
        if (seen.has(entry.ability.key)) continue
        seen.add(entry.ability.key)
        results.push({ key: entry.ability.key, name: entry.ability.name })
      }
    }
    return results
  }

  // ── Constructor: takes CombatState ────────────────────────────────

  constructor(combatState: CombatState) {
    this._combatState = combatState
    this._abilities = AbilitiesParams.loadAbilities(
      combatState.data.attacker.faction,
      combatState.data.defender.faction,
    )
    this._attackerCtx = new AbilityContext('attacker')
    this._attackerCtx._abilitiesParams = this
    this._defenderCtx = new AbilityContext('defender')
    this._defenderCtx._abilitiesParams = this

    this.initializeDefaults()
    this.reconcile()
    this.buildInvokes()
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
    instance._destroyed = { attacker: {}, defender: {} }
    instance._destroyCount = 0
    instance._pendingUnitInvokes = []
    instance._abilities = AbilitiesParams.loadAbilities(
      combatState.data.attacker.faction,
      combatState.data.defender.faction,
    )
    instance._attackerCtx = new AbilityContext('attacker')
    instance._attackerCtx._abilitiesParams = instance
    instance._defenderCtx = new AbilityContext('defender')
    instance._defenderCtx._abilitiesParams = instance
    // Phase 1: Enrich consumers from full SETTINGS (with group additions).
    // Consumer params (e.g. AC targetPriority) sync from enriched groups,
    // so they include all possible targets (e.g. Infantry via Alastor).
    instance.reconcile({ applyGroupAdditions: true, preserveUserParams: true })

    // Phase 2: Reset SETTINGS to base (no group additions), don't touch
    // consumers. Abilities must update SETTINGS at runtime to affect
    // participation — findUnitByPriority filters by participation.
    instance.reconcile({ applyGroupAdditions: false, settingsOnly: true })

    instance.buildInvokes()
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
    instance._destroyed = { attacker: {}, defender: {} }
    instance._destroyCount = 0
    instance._pendingUnitInvokes = []
    instance._abilities = AbilitiesParams.loadAbilities(
      combatState.data.attacker.faction,
      combatState.data.defender.faction,
    )
    instance._attackerCtx = new AbilityContext('attacker')
    instance._attackerCtx._abilitiesParams = instance
    instance._defenderCtx = new AbilityContext('defender')
    instance._defenderCtx._abilitiesParams = instance
    instance.buildInvokes()
    return instance
  }

  /** Collect unit abilities from units on the field */
  static collectUnitAbilities(
    state: CombatStateData,
    side: CombatSide,
  ): UnitAbilityEntry[] {
    const sideState = state[side]

    // Quick check: if no unitStats have ABILITIES, skip the full scan
    let hasAnyAbilities = false
    for (const key in sideState.unitStats) {
      if (resolveUnitStats(sideState, key)?.ABILITIES) {
        hasAnyAbilities = true
        break
      }
    }
    if (!hasAnyAbilities) return []

    const results: UnitAbilityEntry[] = []

    // Iterate unitStats entries (which contain ABILITIES) and multiply by count.
    // Global index is computed across all variant keys of a base type,
    // sorted alphabetically.
    const keysByType = new Map<UnitBaseType, string[]>()
    for (const key of Object.keys(sideState.units)) {
      if (sideState.units[key] <= 0) continue
      const { type } = parseVariantId(key)
      const keys = keysByType.get(type)
      if (keys) keys.push(key)
      else keysByType.set(type, [key])
    }
    // Sort variant keys within each type
    for (const keys of keysByType.values()) {
      keys.sort()
    }

    for (const [unitType, keys] of keysByType) {
      let globalIndex = 0
      for (const key of keys) {
        const count = sideState.units[key]
        const stats = resolveUnitStats(sideState, key)
        if (!stats?.ABILITIES) {
          globalIndex += count
          continue
        }
        for (let i = 0; i < count; i++) {
          for (const ability of stats.ABILITIES) {
            results.push({
              ability,
              unitType,
              unitIndex: globalIndex,
            })
          }
          globalIndex++
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
    const ability = this._abilities[side].find(a => a.key === abilityKey)
    const oldIsEnabled = this.config[side][abilityKey]?.isEnabled
    const oldUses = this.config[side][abilityKey]?.uses

    let finalParams = params
    if (ability?.onParamSet) {
      const oldParams = this.config[side][abilityKey]
      if (oldParams) {
        for (const key of Object.keys(params)) {
          if (params[key] !== oldParams[key]) {
            finalParams =
              ability.onParamSet(finalParams, key, params[key]) ?? finalParams
          }
        }
      }
    }

    const newSideConfig = {
      ...this.config[side],
      [abilityKey]: finalParams,
    }

    // Mutual exclusion: disable other abilities in the same exclusive group
    if (ability?.exclusiveGroup && finalParams.isEnabled) {
      for (const other of this._abilities[side]) {
        if (other.key === abilityKey) continue
        if (other.exclusiveGroup !== ability.exclusiveGroup) continue
        const otherParams = newSideConfig[other.key]
        if (otherParams) {
          newSideConfig[other.key] = {
            ...otherParams,
            isEnabled: false,
          }
        }
      }
    }

    this.config[side] = newSideConfig

    if (ability?.sync) {
      const otherSide = getOpponentSide(side)
      this.config[otherSide] = {
        ...this.config[otherSide],
        [abilityKey]: finalParams,
      }
    }

    if (ability?.declareParamChange) {
      this.reconcile()
    } else if (
      finalParams.isEnabled !== oldIsEnabled ||
      finalParams.uses !== oldUses
    ) {
      this.reconcile({ resetBaseGroups: false })
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
    // Short-circuit: if none of the requested timings have any callable
    // invokes (enabled config abilities, unit abilities, or destroyed-unit
    // abilities), skip the expensive resolution loop entirely.
    let hasAnyInvokes = false
    if (Array.isArray(timing)) {
      for (const t of timing) {
        if (this.hasCallableInvoke(t as AbilityTiming)) {
          hasAnyInvokes = true
          break
        }
      }
    } else {
      hasAnyInvokes = this.hasCallableInvoke(timing as AbilityTiming)
    }

    if (!hasAnyInvokes) {
      return { state, context: context as TimingContextMap[T], log: EMPTY_LOG }
    }

    const activeLogger = logger ?? Logger.create()
    const startIndex = activeLogger.entries.length

    const tracker: InvocationTracker = {
      attacker: {
        configAbilities: new Set(),
        unitAbilities: new Map(),
      },
      defender: {
        configAbilities: new Set(),
        unitAbilities: new Map(),
      },
    }
    // Point CombatState at the current state data
    this._combatState.data = state

    let consecutiveSkips = 0
    let currentSide: CombatSide = options?.triggerSide ?? 'attacker'
    let currentState = state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let workingContext: any = context

    // Snapshot unit counts to detect elimination during resolution
    const initialUnits = {
      attacker: this._combatState.attacker.countUnits(),
      defender: this._combatState.defender.countUnits(),
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

        // Stop resolving abilities if a side that had units was eliminated
        if (
          result.unitsChanged &&
          ((initialUnits.attacker > 0 &&
            this._combatState.attacker.countUnits() === 0) ||
            (initialUnits.defender > 0 &&
              this._combatState.defender.countUnits() === 0))
        ) {
          break
        }
      } else {
        consecutiveSkips += 1
      }

      currentSide = getOpponentSide(currentSide)
    }

    return {
      state: currentState,
      context: workingContext as TimingContextMap[T],
      log: activeLogger.entries.slice(startIndex) as LogEntry[],
    }
  }

  /**
   * Run the DESTROY → WHEN_DESTROY → AFTER_DESTROY sequence.
   * Called after units are destroyed (by ability execution or hit assignment).
   * If a WHEN_DESTROY ability destroys additional units, tryResolveOne
   * triggers a nested runDestroyAbilities for those automatically.
   */
  runDestroyAbilities(
    destroyedContext: {
      attacker: Record<string, number>
      defender: Record<string, number>
    },
    state: CombatStateData,
    logger?: Logger,
  ): CombatStateData {
    const { state: afterDestroy } = this.runAbilities(
      'DESTROY',
      state,
      destroyedContext,
      undefined,
      logger,
    )
    const { state: afterWhenDestroy } = this.runAbilities(
      'WHEN_DESTROY',
      afterDestroy,
      destroyedContext,
      undefined,
      logger,
    )
    const { state: final } = this.runAbilities(
      'AFTER_DESTROY',
      afterWhenDestroy,
      destroyedContext,
      undefined,
      logger,
    )
    return final
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

    const sideTracker = tracker[side]

    for (const { ability, invoke, params, source } of invokes) {
      // Check if already invoked
      if (source.type === 'config') {
        if (sideTracker.configAbilities.has(invoke)) {
          continue
        }
      } else {
        const totalCount = totalCountForType(state[side].units, source.unitType)
        const isDestroyTiming =
          invoke.timing === 'DESTROY' ||
          invoke.timing === 'WHEN_DESTROY' ||
          invoke.timing === 'AFTER_DESTROY'

        if (isDestroyTiming) {
          // DESTROY fires for units that are GONE and RECENTLY destroyed
          if (totalCount > source.unitIndex) continue // Unit still alive
          // Verify the unit was destroyed in this context (not a prior round)
          if (context !== undefined && isSidedContext(context)) {
            const destroyedCounts = (
              context as SidedContext<Record<string, number>>
            )[side]
            const destroyedForType = totalCountForType(
              destroyedCounts,
              source.unitType,
            )
            if (source.unitIndex >= totalCount + destroyedForType) continue
          }
        } else {
          // Normal abilities fire for units that EXIST
          if (totalCount <= source.unitIndex) continue // Unit destroyed
        }

        // Check if this unit instance already invoked this ability
        const key = `${invoke.timing}:${source.unitType}:${ability.key}`
        const invokedIndices = sideTracker.unitAbilities.get(key)
        if (invokedIndices?.has(source.unitIndex)) {
          continue
        }
      }

      // Merge pre-merged params with live config so runtime changes
      // (uses decrement, structures update, isEnabled toggle) are visible
      // while defaults from extractDefaults remain available.
      const liveConfig = state.abilities[side][ability.key]
      const freshParams = liveConfig ? { ...params, ...liveConfig } : params

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

      const isDestroyTiming =
        invoke.timing === 'DESTROY' ||
        invoke.timing === 'WHEN_DESTROY' ||
        invoke.timing === 'AFTER_DESTROY'
      const unitSource =
        source.type === 'unit' && !isDestroyTiming
          ? { unitType: source.unitType, unitIndex: source.unitIndex }
          : undefined

      // Global isEnabled / uses gate
      if ('isEnabled' in freshParams && !freshParams.isEnabled) continue
      if (
        'uses' in freshParams &&
        typeof freshParams.uses === 'number' &&
        freshParams.uses <= 0
      )
        continue

      const ctx = this.context(side)
      ctx.unitSource = unitSource

      let canCall: boolean
      if (inv.isCallable) {
        if (inv.isCallable.length <= 1) {
          canCall = inv.isCallable(freshParams)
        } else if (diceTiming && internalContext) {
          const rawDice = internalContext as OwnOpponentContext<DicePool>
          const diceReadCtx: DiceReadContext = {
            own: buildDiceReadApi(rawDice.own),
            opponent: buildDiceReadApi(rawDice.opponent),
          }
          canCall = inv.isCallable(freshParams, ctx, diceReadCtx)
        } else {
          canCall = inv.isCallable(freshParams, ctx, internalContext)
        }
      } else {
        canCall = true
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
        const triggerCallback = (event: TriggerEvent) => {
          triggerEvents.push(event)
        }

        // Reset per-ability destroyed tracking
        const timingArray = Array.isArray(timing) ? timing : [timing]
        this._destroyed = { attacker: {}, defender: {} }
        const prevDestroyCount = this._destroyCount

        // Wrap call in Immer produce
        let resultState: CombatStateData
        if (diceTiming && internalContext) {
          const rawDice = internalContext as OwnOpponentContext<DicePool>
          const diceCallCtx: DiceContext = {
            own: buildDiceApi(rawDice.own),
            opponent: buildDiceApi(rawDice.opponent),
          }
          resultState = create(state, draft => {
            ctx.upgradeForCall(draft, ability.key, logCallback, triggerCallback)
            inv.call(ctx, freshParams, diceCallCtx)
            decrementUses(draft, side, ability.key, freshParams, this)
          })
          ctx.resetAfterCall()
          resultContext = {
            own: diceCallCtx.own.getAll(),
            opponent: diceCallCtx.opponent.getAll(),
          }
        } else {
          resultState = create(state, draft => {
            ctx.upgradeForCall(draft, ability.key, logCallback, triggerCallback)
            const result = inv.call(ctx, freshParams, internalContext)
            if (result !== undefined) resultContext = result
            decrementUses(draft, side, ability.key, freshParams, this)
          })
          ctx.resetAfterCall()
        }

        // Flush deferred invoke registrations (from placeUnits/modifyUnitType inside produce)
        this.flushPendingUnitInvokes(resultState)

        // Single structured log entry per ability
        const childLogger = logger?.child(invoke.timing).child(ability.key)
        if (childLogger) {
          const sideLogger = childLogger.forSide(side)
          if (logData.length > 0) {
            sideLogger.log(...logData)
          } else {
            sideLogger.log()
          }
        }

        // Mark as invoked
        if (source.type === 'config') {
          sideTracker.configAbilities.add(invoke)
        } else {
          const key = `${invoke.timing}:${source.unitType}:${ability.key}`
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
            childLogger,
          )
          resultState = triggerResult.state
        }

        // Trigger DESTROY → WHEN_DESTROY → AFTER_DESTROY if units were destroyed.
        // Recursion is safe — controlled by ability uses/invocation tracker.
        {
          const hasDestroyed =
            Object.keys(this._destroyed.attacker).length > 0 ||
            Object.keys(this._destroyed.defender).length > 0

          if (hasDestroyed) {
            resultState = this.runDestroyAbilities(
              this._destroyed,
              resultState,
              childLogger,
            )
          }
        }

        // Process pending hit pools produced by the ability.
        // Skip during BEFORE_ASSIGN_HITS (recursion) and during DICE_ROLL
        // micro-phase (hits from dice flow are assigned at ASSIGN_HITS).
        if (
          !timingArray.some(t => t === 'BEFORE_ASSIGN_HITS') &&
          state.currentPhase.micro !== 'DICE_ROLL' &&
          state.currentPhase.micro !== 'ASSIGN_HITS' &&
          (resultState.attacker.hitPools.length > 0 ||
            resultState.defender.hitPools.length > 0)
        ) {
          const cs = CombatState.fromData(resultState, this)
          const { state: afterAssign } = cs.assignHits(childLogger)
          resultState = afterAssign.data
        }

        const unitsDestroyed = this._destroyCount > prevDestroyCount
        const unitsChanged =
          state.attacker.units !== resultState.attacker.units ||
          state.defender.units !== resultState.defender.units

        // Adjust tracker indices when units were destroyed by triggers/AFTER_DESTROY
        if (unitsDestroyed) {
          adjustTrackerForDestroyedUnits(tracker, state, resultState)
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
          unitsChanged,
        }
      }
    }

    return null
  }

  /**
   * Build unified invoke collection once — config + unit entries.
   * Called at init; never rebuilt. Stale entries (destroyed units) are
   * safely skipped by the existence check in tryResolveOne.
   */
  private buildInvokes(): void {
    const collections: InvokeCollections = {
      attacker: new Map(),
      defender: new Map(),
    }
    const state = this.state

    for (const side of ['attacker', 'defender'] as const) {
      const sideMap = collections[side]
      const sideConfig = state.abilities[side]
      const factionUnitKeys = getUnitDefinitionAbilityKeys(state[side].faction)

      // 1. Config invokes (non-unit-definition abilities)
      for (const ability of this._abilities[side]) {
        if (factionUnitKeys.has(ability.key)) continue
        if (ability.context && ability.context !== state.combatMode) continue

        const configParams = sideConfig[ability.key]
        const mergedParams = configParams
          ? { ...extractDefaults(ability), ...configParams }
          : extractDefaults(ability)

        // Filter by isEnabled — syncInvokesForKey handles runtime changes
        if ('isEnabled' in mergedParams && !mergedParams.isEnabled) continue

        for (const invoke of ability.invoke) {
          if (
            'uses' in mergedParams &&
            typeof mergedParams.uses === 'number' &&
            mergedParams.uses <= 0
          )
            continue
          const list = sideMap.get(invoke.timing)
          const entry: TimingInvokeEntry = {
            ability,
            invoke,
            params: mergedParams,
            source: { type: 'config' },
          }
          if (list) list.push(entry)
          else sideMap.set(invoke.timing, [entry])
        }
      }

      // 2. Unit invokes from initial state
      const unitAbilities = AbilitiesParams.collectUnitAbilities(state, side)
      for (const { ability, unitType, unitIndex } of unitAbilities) {
        if (ability.context && ability.context !== state.combatMode) continue
        const configParams = sideConfig[ability.key]
        const mergedParams = configParams
          ? { ...extractDefaults(ability), ...configParams }
          : extractDefaults(ability)

        for (const invoke of ability.invoke) {
          const list = sideMap.get(invoke.timing)
          const entry: TimingInvokeEntry = {
            ability,
            invoke,
            params: mergedParams,
            source: { type: 'unit', unitType, unitIndex },
          }
          if (list) list.push(entry)
          else sideMap.set(invoke.timing, [entry])
        }
      }
    }

    this._combatState._invokes = collections
    this._combatState._invokesOwned = true
  }

  /**
   * Check if any invoke (config or unit) for the given timing is callable
   * (isEnabled !== false, uses > 0).
   * For unit entries, existence check is deferred to tryResolveOne.
   *
   * Results are cached per state.abilities reference — when abilities
   * config doesn't change (no ability fires), repeated checks for the
   * same timing are O(1).
   */
  private hasCallableInvoke(timing: AbilityTiming): boolean {
    const invokes = this._combatState._invokes
    const attackerEntries = invokes.attacker.get(timing)
    if (attackerEntries && attackerEntries.length > 0) return true
    const defenderEntries = invokes.defender.get(timing)
    return defenderEntries !== undefined && defenderEntries.length > 0
  }

  /**
   * Queue invoke registration for after Immer produce completes.
   * Called from placeUnits/modifyUnitType inside the produce — draft proxies
   * would be revoked if we registered immediately.
   */
  queueUnitInvokes(
    side: CombatSide,
    variantKey: string,
    startSubIndex: number,
    count: number,
  ): void {
    this._pendingUnitInvokes.push({ side, variantKey, startSubIndex, count })
  }

  /**
   * Flush pending invoke registrations using finalized (non-draft) state.
   * Called after Immer produce completes in tryResolveOne.
   */
  flushPendingUnitInvokes(state: CombatStateData): void {
    if (this._pendingUnitInvokes.length === 0) return
    const pending = this._pendingUnitInvokes
    this._pendingUnitInvokes = []
    for (const { side, variantKey, startSubIndex, count } of pending) {
      this.appendUnitInvokes(
        side,
        state[side],
        variantKey,
        startSubIndex,
        count,
      )
    }
  }

  /**
   * Append invoke entries for units that just gained abilities.
   * Called from placeUnits (new units) and modifyUnitType (existing units gain ABILITIES).
   */
  appendUnitInvokes(
    side: CombatSide,
    sideState: SideStateData,
    variantKey: string,
    startSubIndex: number,
    count: number,
  ): void {
    const stats = resolveUnitStats(sideState, variantKey)
    if (!stats?.ABILITIES) return

    this._combatState.ensureOwnInvokes()
    const sideConfig = this.state.abilities[side]
    const sideMap = this._combatState._invokes[side]
    const { type: unitType } = parseVariantId(variantKey)

    for (const ability of stats.ABILITIES) {
      if (ability.context && ability.context !== this.state.combatMode) continue
      const configParams = sideConfig[ability.key]
      const mergedParams = configParams
        ? { ...extractDefaults(ability), ...configParams }
        : extractDefaults(ability)

      for (const invoke of ability.invoke) {
        const baseGlobalIndex = toGlobalIndex(
          sideState,
          variantKey,
          startSubIndex,
        )
        for (let i = 0; i < count; i++) {
          const entry: TimingInvokeEntry = {
            ability,
            invoke,
            params: mergedParams,
            source: {
              type: 'unit',
              unitType: unitType as UnitBaseType,
              unitIndex: baseGlobalIndex + i,
            },
          }
          const list = sideMap.get(invoke.timing)
          if (list) list.push(entry)
          else sideMap.set(invoke.timing, [entry])
        }
      }
    }
  }

  /** Remove config-source invoke entries for a given ability key */
  private removeConfigInvokeEntries(
    side: CombatSide,
    abilityKey: string,
    keepIf?: (entry: TimingInvokeEntry) => boolean,
  ): void {
    this._combatState.ensureOwnInvokes()
    const sideMap = this._combatState._invokes[side]
    for (const [timing, entries] of sideMap) {
      const filtered = entries.filter(e => {
        if (e.source.type !== 'config' || e.ability.key !== abilityKey)
          return true
        return keepIf ? keepIf(e) : false
      })
      if (filtered.length !== entries.length) {
        if (filtered.length === 0) sideMap.delete(timing)
        else sideMap.set(timing, filtered)
      }
    }
  }

  /** Add config ability invokes to _invokes (caller must ensure isEnabled check) */
  private addConfigAbilityInvokes(
    side: CombatSide,
    ability: Ability,
    mergedParams: Record<string, unknown>,
    state: CombatStateData,
  ): void {
    if (ability.context && ability.context !== state.combatMode) return
    this._combatState.ensureOwnInvokes()
    const sideMap = this._combatState._invokes[side]
    for (const invoke of ability.invoke) {
      if (
        'uses' in mergedParams &&
        typeof mergedParams.uses === 'number' &&
        mergedParams.uses <= 0
      )
        continue
      const entry: TimingInvokeEntry = {
        ability,
        invoke,
        params: mergedParams,
        source: { type: 'config' },
      }
      const list = sideMap.get(invoke.timing)
      if (list) list.push(entry)
      else sideMap.set(invoke.timing, [entry])
    }
  }

  /**
   * Sync _invokes for a single ability key on one side.
   * Called from within Immer produce (updateAbilityConfig / decrementUses)
   * so it operates on the draft state.
   */
  syncInvokesForKey(
    side: CombatSide,
    key: string,
    draft: CombatStateData,
  ): void {
    const factionUnitKeys = getUnitDefinitionAbilityKeys(draft[side].faction)
    if (factionUnitKeys.has(key)) return

    const ability = this._abilities[side].find(a => a.key === key)
    if (!ability) return

    this.removeConfigInvokeEntries(side, key)

    const newConfig = draft.abilities[side][key]
    const defaults = extractDefaults(ability)
    const mergedParams = newConfig ? { ...defaults, ...newConfig } : defaults

    if ('isEnabled' in mergedParams && !mergedParams.isEnabled) return

    this.addConfigAbilityInvokes(side, ability, mergedParams, draft)
  }

  /**
   * Reconcile SETTINGS computed params directly on an Immer draft.
   * Called from updateAbilityConfig when SETTINGS is modified during produce.
   */
  reconcileSettingsOnDraft(draft: CombatStateData): void {
    for (const side of ['attacker', 'defender'] as const) {
      const sideAbilities = this._abilities[side]
      const { settings, subtypes } = resolveSettings(
        sideAbilities,
        draft.abilities[side],
      )
      this.reconcileSyncSources(
        side,
        sideAbilities.filter(a => a.key === 'SETTINGS'),
        draft.abilities[side],
        settings,
        settings,
        subtypes,
        subtypes,
      )
    }
  }

  /** Get invokes for a timing (or multiple timings) from unified invoke collection. */
  private getInvokesForTiming<T extends AbilityTiming>(
    timing: T | T[],
    side: CombatSide,
    state: CombatStateData,
    triggerSide?: CombatSide,
  ): TimingInvokeEntry[] {
    const timings = Array.isArray(timing) ? timing : [timing]
    const { meta } = state.currentPhase
    const results: TimingInvokeEntry[] = []

    const sideMap = this._combatState._invokes[side]
    for (const t of timings) {
      const entries = sideMap.get(t as AbilityTiming)
      if (!entries) continue
      for (const entry of entries) {
        // Filter by invoke.context (MetaPhase) — not pre-filtered
        if (entry.invoke.context) {
          const allowed = Array.isArray(entry.invoke.context)
            ? entry.invoke.context
            : [entry.invoke.context]
          if (!allowed.includes(meta)) continue
        }
        // Filter by triggerSide
        if (triggerSide && entry.invoke.side) {
          if (entry.invoke.side === 'OWN' && side !== triggerSide) continue
          if (entry.invoke.side === 'OPPONENT' && side === triggerSide) continue
        }
        results.push(entry)
      }
    }

    // Apply ABILITY_ORDER sorting across all collected entries (matches old
    // behavior where entries from different timings in the same group were
    // interleaved by user-chosen ability order).
    if (results.length > 1) {
      const timingSet = new Set(timings)
      const sideConfig = state.abilities[side]
      for (const group of TIMING_GROUPS) {
        if (!group.timings.some(t => timingSet.has(t as T))) continue
        const orderConfig = sideConfig['ABILITY_ORDER']
        if (!orderConfig) break
        const order = orderConfig[group.paramKey] as string[] | undefined
        if (!order || order.length === 0) break

        const orderIndex = new Map(order.map((key, i) => [key, i]))
        let nextSlot = order.length
        const sortKey = new Map<TimingInvokeEntry, number>()
        for (const entry of results) {
          const oi = orderIndex.get(entry.ability.key)
          sortKey.set(entry, oi !== undefined ? oi : nextSlot++)
        }
        results.sort((a, b) => sortKey.get(a)! - sortKey.get(b)!)
        break // Only one group can match
      }
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
      settingsOnly?: boolean
    } = {},
  ): void {
    const {
      resetBaseGroups = true,
      applyGroupAdditions = true,
      preserveUserParams = false,
      settingsOnly = false,
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

        // Two passes: first builds groups (groundForces, etc.),
        // second resolves cross-group deps (e.g. Alastor copies groundForces → ships)
        for (let pass = 0; pass < 2; pass++) {
          const changes = this.collectParamChanges(
            abilities,
            config[side],
            settings,
          )
          for (const change of changes) {
            if (change.key === 'subtypes') {
              const subtypes = settings.subtypes as DeclaredSubtype[]
              const sub = change.value as DeclaredSubtype
              if (
                !subtypes.some(
                  s => s.name === sub.name && s.unitType === sub.unitType,
                )
              ) {
                subtypes.push(sub)
              }
            } else if (applyGroupAdditions) {
              const group = settings[change.key] as UnitBaseType[]
              if (group && !group.includes(change.value as UnitBaseType)) {
                group.push(change.value as UnitBaseType)
              }
            }
          }
        }
      }
    }

    if (settingsOnly) {
      // Only reconcile SETTINGS computed params, skip consumers
      for (const side of ['attacker', 'defender'] as const) {
        const sideAbilities = this._abilities[side]
        const { settings, subtypes } = resolveSettings(
          sideAbilities,
          config[side],
        )
        this.reconcileSyncSources(
          side,
          sideAbilities.filter(a => a.key === 'SETTINGS'),
          config[side],
          settings,
          settings,
          subtypes,
          subtypes,
        )
      }
      this._combatState.data = { ...this._combatState.data, abilities: config }
      return
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

    this.reconcileAbilityOrder(config)

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
        side,
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
        side,
        sideAbilities.filter(a => a.key !== 'SETTINGS'),
        config[side],
        ownSettings,
        oppSettings,
        ownSubtypes,
        oppSubtypes,
      )
    }
  }

  /**
   * Reconcile ABILITY_ORDER params: keep only keys for abilities that are
   * enabled and have matching invokes, preserving user-chosen order.
   */
  private reconcileAbilityOrder(config: AbilitiesConfig): void {
    for (const side of ['attacker', 'defender'] as const) {
      const abilities = this._abilities[side]
      const sideConfig = config[side]

      if (!sideConfig['ABILITY_ORDER']) {
        sideConfig['ABILITY_ORDER'] = { isEnabled: true, uses: Infinity }
      } else if (Object.isFrozen(sideConfig['ABILITY_ORDER'])) {
        sideConfig['ABILITY_ORDER'] = { ...sideConfig['ABILITY_ORDER'] }
      }
      const orderConfig = sideConfig['ABILITY_ORDER']

      for (const group of TIMING_GROUPS) {
        const timingSet = new Set(group.timings)
        const validKeys: string[] = []

        for (const ability of abilities) {
          if (ability.key === 'ABILITY_ORDER') continue
          if (ability.context && ability.context !== this.state.combatMode)
            continue
          const abilityConfig = sideConfig[ability.key] ?? ability.params
          if ('isEnabled' in abilityConfig && !abilityConfig.isEnabled) continue
          if (
            'uses' in abilityConfig &&
            typeof abilityConfig.uses === 'number' &&
            isFinite(abilityConfig.uses) &&
            abilityConfig.uses <= 0
          )
            continue
          const hasMatchingInvoke = ability.invoke.some(inv =>
            timingSet.has(inv.timing),
          )
          if (hasMatchingInvoke) {
            validKeys.push(ability.key)
          }
        }

        const currentOrder = (orderConfig[group.paramKey] as string[]) ?? []
        orderConfig[group.paramKey] = reconcileArrayParam(
          currentOrder,
          validKeys,
        )
      }
    }
  }

  // ── Inlined utils ──────────────────────────────────────────────────

  private collectParamChanges(
    abilities: readonly Ability[],
    params: Record<string, Record<string, unknown>>,
    settings: Readonly<Record<string, unknown>>,
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

      const declared = ability.declareParamChange(abilityParams, settings)
      result.push(...declared)
    }

    return result
  }

  private reconcileSyncSources(
    _side: CombatSide,
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

        let validList = buildValidList(
          config,
          ownSettings,
          opponentSettings,
          ownSubtypes,
          opponentSubtypes,
        )

        if (config.filter) {
          validList = validList.filter(config.filter)
        }

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
