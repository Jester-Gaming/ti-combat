import type {
  CombatSide,
  FactionKey,
  UnitBaseType,
  UnitId,
  UnitType,
} from '@/types'

import {
  getOpponentSide,
  resolveUnitStats,
} from '../combat-side-state/combat-side-state'
import { CombatState } from '../combat-state/combat-state'
import type { CombatStateData, SideStateData } from '../combat-state/types'
import { Logger } from '../logger'
import { parseVariantId } from '../utils/unit-variant'
import { AbilityContext } from './api/ability-api'
import { buildDiceApi, buildDiceReadApi } from './api/dice-api'
import { extractDefaults } from './declare-param'
import type {
  Ability,
  AbilityInvoke,
  AbilityTiming,
  DiceContext,
  DicePool,
  DiceReadContext,
  InternalTimingContextMap,
  OwnOpponentContext,
  SidedContext,
  TimingContextMap,
} from './types'

export const TIMING_GROUPS: {
  timings: AbilityTiming[]
  paramKey: string
  label: string
}[] = [
  {
    timings: ['START_OF_COMBAT', 'START_OF_COMBAT_ROUND'],
    paramKey: 'startOfCombat',
    label: 'Start of Combat (round)',
  },
  {
    timings: ['BEFORE_ASSIGN_HITS'],
    paramKey: 'beforeAssignHits',
    label: 'Before Assign Hits',
  },
]

const EMPTY_DESTROYED_IDS: { attacker: Set<UnitId>; defender: Set<UnitId> } = {
  attacker: new Set(),
  defender: new Set(),
}
const EMPTY_PENDING: {
  side: CombatSide
  variantKey: string
  unitIds: UnitId[]
}[] = []
// ── Ability execution engine (module-private helpers) ────────────────────

/** Source of an ability - either from config, a deploy ability, or a unit */
type AbilitySource =
  | { type: 'config' }
  | { type: 'deploy'; unitType: UnitBaseType }
  | { type: 'unit'; unitType: UnitBaseType; unitId: UnitId }

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
  unitId: UnitId
}

interface TimingInvokeEntry {
  ability: Ability
  invoke: AbilityInvoke
  params: Record<string, unknown>
  source: AbilitySource
  ownerFaction?: FactionKey
}

/** Count total units across all variant keys */
function countAllUnits(units: Record<string, unknown[]>): number {
  let n = 0
  for (const key in units) n += units[key].length
  return n
}

/** Copy-on-write: shallow-copy the abilities path so in-place mutations
 *  don't leak into other branches that share the same abilities object.
 *  Returns the (now owned) ability entry for `abilityKey`. */
function cowAbilityEntry(
  draft: CombatStateData,
  side: CombatSide,
  abilityKey: string,
): Record<string, unknown> {
  draft.abilities = { ...draft.abilities }
  draft.abilities[side] = { ...draft.abilities[side] }
  const entry = draft.abilities[side][abilityKey]
  const clone = entry ? { ...entry } : {}
  draft.abilities[side][abilityKey] = clone
  return clone
}

/** Decrement `uses` in ability config after a successful invocation */
function decrementUses(
  draft: CombatStateData,
  side: CombatSide,
  abilityKey: string,
  params: Record<string, unknown>,
  engine?: AbilitiesEngine,
): void {
  if (
    'uses' in params &&
    typeof params.uses === 'number' &&
    isFinite(params.uses)
  ) {
    const config = draft.abilities[side][abilityKey]
    const entry = cowAbilityEntry(draft, side, abilityKey)
    if (config && typeof config.uses === 'number') {
      entry.uses = config.uses - 1
    } else {
      entry.uses = params.uses - 1
    }
    if (engine) {
      engine.syncInvokesForKey(side, abilityKey, draft)
    }
  }
}

function isDiceTiming(timing: AbilityTiming | AbilityTiming[]): boolean {
  const timings = Array.isArray(timing) ? timing : [timing]
  return timings.some(
    t => t === 'BEFORE_DICE_ROLL' || t === 'BEFORE_UNIT_ABILITY_ROLL',
  )
}

// ── Tracker types ────────────────────────────────────────────────────────

/** Invocation tracker for a single side's abilities */
interface SideInvocationTracker {
  configAbilities: Set<AbilityInvoke>
  unitAbilities: Map<string, Set<UnitId>> // "timing:unitType:abilityKey" -> Set<UnitId>
}

/** Invocation tracker per side */
type InvocationTracker = Record<CombatSide, SideInvocationTracker>

interface AbilityResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any
  unitsChanged?: boolean
}

export interface RunAbilitiesOptions {
  triggerSide?: CombatSide
  skipSides?: CombatSide[]
}

// ── Main class ───────────────────────────────────────────────────────────

export interface InvokeCollections {
  attacker: Map<AbilityTiming, TimingInvokeEntry[]>
  defender: Map<AbilityTiming, TimingInvokeEntry[]>
  _hasDestroyAbilities?: boolean
}

export function cloneInvokes(invokes: InvokeCollections): InvokeCollections {
  return {
    attacker: new Map(Array.from(invokes.attacker, ([k, v]) => [k, [...v]])),
    defender: new Map(Array.from(invokes.defender, ([k, v]) => [k, [...v]])),
  }
}

/**
 * Simulation-only ability engine.
 *
 * Has a direct bidirectional link with CombatState — reads and writes
 * ability config through CombatState.data.abilities. Abilities mutate
 * the shared Mutative draft on CombatState.data directly.
 */
export class AbilitiesEngine {
  private _combatState!: CombatState
  private _abilities!: Record<CombatSide, Ability[]>
  private _unitAbilityKeys!: Record<CombatSide, ReadonlySet<string>>
  private _factionOwnedKeys!: Record<CombatSide, ReadonlySet<string>>
  private _attackerCtx!: AbilityContext
  private _defenderCtx!: AbilityContext

  /** UnitIds destroyed during current produce / set by runDestroyAbilities for timing checks */
  _destroyedIds: {
    attacker: Set<UnitId>
    defender: Set<UnitId>
  } = EMPTY_DESTROYED_IDS

  /** Deferred invoke registrations — flushed after ability call completes */
  _pendingUnitInvokes: {
    side: CombatSide
    variantKey: string
    unitIds: UnitId[]
  }[] = EMPTY_PENDING

  _logger?: Logger

  private get state(): CombatStateData {
    return this._combatState.data
  }

  get combatState(): CombatState {
    return this._combatState
  }

  setCombatState(cs: CombatState, logger?: Logger): void {
    this._combatState = cs
    this._logger = logger
    this._destroyedIds = EMPTY_DESTROYED_IDS
    this._pendingUnitInvokes = EMPTY_PENDING
  }

  // ── Read accessors ──────────────────────────────────────────────────

  get attackerFaction(): FactionKey {
    return this.state.attacker.faction
  }

  get defenderFaction(): FactionKey {
    return this.state.defender.faction
  }

  get config() {
    return this.state.abilities
  }

  getAbilities(side: CombatSide): Ability[] {
    return this._abilities[side]
  }

  get unitAbilityKeys(): Record<CombatSide, ReadonlySet<string>> {
    return this._unitAbilityKeys
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

  /** Fast check: any DESTROY/WHEN_DESTROY/AFTER_DESTROY invokes registered? */
  hasDestroyAbilities(): boolean {
    const invokes = this._combatState._invokes
    if (invokes._hasDestroyAbilities !== undefined)
      return invokes._hasDestroyAbilities
    let result = false
    for (const side of ['attacker', 'defender'] as const) {
      const sideMap = invokes[side]
      if (
        sideMap.get('DESTROY')?.length ||
        sideMap.get('WHEN_DESTROY')?.length ||
        sideMap.get('AFTER_DESTROY')?.length
      ) {
        result = true
        break
      }
    }
    invokes._hasDestroyAbilities = result
    return result
  }

  // ── Factories ──────────────────────────────────────────────────────

  /**
   * Create from pre-reconciled config data (simulation initialization path).
   *
   * Expects the caller to have already run reconciliation
   * (via prepareSimulationConfig). This factory just loads abilities
   * and builds invokes from the config as-is.
   */
  static fromConfig(
    combatState: CombatState,
    abilities: Record<CombatSide, Ability[]>,
    unitAbilityKeys: Record<CombatSide, ReadonlySet<string>>,
    factionOwnedKeys: Record<CombatSide, ReadonlySet<string>>,
  ): AbilitiesEngine {
    const instance = Object.create(AbilitiesEngine.prototype) as AbilitiesEngine
    instance._combatState = combatState
    instance._destroyedIds = EMPTY_DESTROYED_IDS
    instance._pendingUnitInvokes = EMPTY_PENDING
    instance._abilities = abilities
    instance._unitAbilityKeys = unitAbilityKeys
    instance._factionOwnedKeys = factionOwnedKeys
    instance._attackerCtx = new AbilityContext('attacker', instance)
    instance._defenderCtx = new AbilityContext('defender', instance)
    instance.buildInvokes()
    return instance
  }

  /**
   * Lightweight factory — creates instance without cloning or reconciliation.
   * Used for read-only contexts where we only need ability lookups and
   * default merging (CombatState.fromData fallback, etc.).
   */
  static wrap(
    combatState: CombatState,
    abilities: Record<CombatSide, Ability[]>,
    unitAbilityKeys: Record<CombatSide, ReadonlySet<string>>,
    factionOwnedKeys: Record<CombatSide, ReadonlySet<string>>,
  ): AbilitiesEngine {
    const instance = Object.create(AbilitiesEngine.prototype) as AbilitiesEngine
    instance._combatState = combatState
    instance._destroyedIds = EMPTY_DESTROYED_IDS
    instance._pendingUnitInvokes = EMPTY_PENDING
    instance._abilities = abilities
    instance._unitAbilityKeys = unitAbilityKeys
    instance._factionOwnedKeys = factionOwnedKeys
    instance._attackerCtx = new AbilityContext('attacker', instance)
    instance._defenderCtx = new AbilityContext('defender', instance)
    instance.buildInvokes()
    return instance
  }

  /** Collect unit abilities from units on the field */
  static collectUnitAbilities(
    state: CombatStateData,
    side: CombatSide,
  ): UnitAbilityEntry[] {
    const sideState = state[side]

    // Quick check: skip if no unit stats have ABILITIES at all
    let hasAnyAbilities = false
    for (const key in sideState.unitStats) {
      if (resolveUnitStats(sideState.unitStats, key as UnitType)?.ABILITIES) {
        hasAnyAbilities = true
        break
      }
    }
    if (!hasAnyAbilities) return []

    const entries: UnitAbilityEntry[] = []

    for (const key of Object.keys(sideState.units)) {
      const ids = sideState.units[key]
      if (!ids || ids.length <= 0) continue
      const stats = resolveUnitStats(sideState.unitStats, key as UnitType)
      if (!stats?.ABILITIES) continue
      const { type: unitType } = parseVariantId(key as UnitType)

      for (const id of ids) {
        for (const ability of stats.ABILITIES) {
          entries.push({
            ability,
            unitType: unitType as UnitBaseType,
            unitId: id,
          })
        }
      }
    }
    return entries
  }

  /** Collect deploy abilities from unit stats (not requiring units on field) */
  static collectDeployAbilities(
    state: CombatStateData,
    side: CombatSide,
  ): { ability: Ability; unitType: UnitBaseType }[] {
    const sideState = state[side]
    const seen = new Set<UnitBaseType>()
    const entries: { ability: Ability; unitType: UnitBaseType }[] = []

    for (const key of Object.keys(sideState.unitStats)) {
      const stats = resolveUnitStats(sideState.unitStats, key as UnitType)
      const deploy = stats?.UNIT_ABILITIES?.DEPLOY
      if (!deploy) continue
      const { type: baseType } = parseVariantId(key as UnitType)
      if (seen.has(baseType as UnitBaseType)) continue
      seen.add(baseType as UnitBaseType)
      entries.push({ ability: deploy, unitType: baseType as UnitBaseType })
    }
    return entries
  }

  // ── Ability execution engine ──────────────────────────────────────

  runAbilities<T extends AbilityTiming>(
    timing: T | T[],
    context?: TimingContextMap[T],
    options?: RunAbilitiesOptions,
    logger?: Logger,
  ): TimingContextMap[T] {
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
      return context as TimingContextMap[T]
    }

    const activeLogger = logger ?? this._logger

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

    let consecutiveSkips = 0
    let currentSide: CombatSide = 'attacker'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let workingContext: any = context

    const initialUnits = {
      attacker: this._combatState.attacker.countUnits(),
      defender: this._combatState.defender.countUnits(),
    }

    while (consecutiveSkips < 2) {
      if (options?.skipSides?.includes(currentSide)) {
        consecutiveSkips += 1
        currentSide = getOpponentSide(currentSide)
        continue
      }

      const result = this.tryResolveOne(
        timing,
        currentSide,
        workingContext,
        tracker,
        options?.triggerSide,
        activeLogger,
      )

      if (result) {
        if (result.context !== undefined) {
          workingContext = result.context
        }
        consecutiveSkips = 0

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

    return workingContext as TimingContextMap[T]
  }

  runDestroyAbilities(destroyed: {
    attacker: Record<string, UnitId[]>
    defender: Record<string, UnitId[]>
  }): void {
    const savedDestroyedIds = this._destroyedIds
    this._destroyedIds = {
      attacker: new Set(Object.values(destroyed.attacker).flat()),
      defender: new Set(Object.values(destroyed.defender).flat()),
    }

    this.runAbilities('DESTROY', destroyed)
    this.runAbilities('WHEN_DESTROY', destroyed)
    this.runAbilities('AFTER_DESTROY', destroyed)

    this._destroyedIds = savedDestroyedIds
  }

  // ── Private execution engine methods ──────────────────────────────

  private tryResolveOne<T extends AbilityTiming>(
    timing: T | T[],
    side: CombatSide,
    context: TimingContextMap[T] | undefined,
    tracker: InvocationTracker,
    triggerSide?: CombatSide,
    logger?: Logger,
  ): AbilityResult | null {
    const state = this._combatState.data
    const invokes = this.getInvokesForTiming(timing, side, triggerSide)

    const sideTracker = tracker[side]

    for (const { ability, invoke, params, source, ownerFaction } of invokes) {
      // Check if already invoked
      if (source.type === 'config') {
        if (sideTracker.configAbilities.has(invoke)) {
          continue
        }
      } else if (source.type === 'deploy') {
        if (sideTracker.configAbilities.has(invoke)) continue
        const sideState = this._combatState.side(side)
        if (sideState.isRestricted('lost', 'DEPLOY', source.unitType)) continue
        if (sideState.isRestricted('cannotBeUsed', 'DEPLOY', source.unitType))
          continue
      } else {
        const sideUnits = state[side].units
        let unitAlive = false
        for (const key of Object.keys(sideUnits)) {
          const { type } = parseVariantId(key)
          if (type !== source.unitType) continue
          if (sideUnits[key]?.includes(source.unitId)) {
            unitAlive = true
            break
          }
        }

        const isDestroyTiming =
          invoke.timing === 'DESTROY' ||
          invoke.timing === 'WHEN_DESTROY' ||
          invoke.timing === 'AFTER_DESTROY'

        if (isDestroyTiming) {
          if (unitAlive) continue
          if (!this._destroyedIds[side].has(source.unitId)) continue
        } else {
          if (!unitAlive) continue
        }

        const key = `${invoke.timing}:${source.unitType}:${ability.key}`
        const invokedIds = sideTracker.unitAbilities.get(key)
        if (invokedIds?.has(source.unitId)) {
          continue
        }
      }

      const liveConfig = state.abilities[side][ability.key]
      const freshParams = liveConfig ? { ...params, ...liveConfig } : params

      let internalContext: InternalTimingContextMap[T] | undefined
      if (context !== undefined && isSidedContext(context)) {
        internalContext = toOwnOpponent(
          context,
          side,
        ) as InternalTimingContextMap[T]
      } else {
        internalContext = context as InternalTimingContextMap[T] | undefined
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inv = invoke as any
      const diceTiming = isDiceTiming(timing)

      const isDestroyTiming =
        invoke.timing === 'DESTROY' ||
        invoke.timing === 'WHEN_DESTROY' ||
        invoke.timing === 'AFTER_DESTROY'
      const unitSource =
        source.type === 'unit' && !isDestroyTiming ? source.unitId : undefined

      if ('isEnabled' in freshParams && !freshParams.isEnabled) continue
      if (
        'uses' in freshParams &&
        typeof freshParams.uses === 'number' &&
        freshParams.uses <= 0
      )
        continue

      const ctx = this.context(side)
      ctx.unitSource = unitSource
      ctx.ownerFaction = ownerFaction

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

        const timingArray = Array.isArray(timing) ? timing : [timing]

        const prevAttackerUnitCount = countAllUnits(state.attacker.units)
        const prevDefenderUnitCount = countAllUnits(state.defender.units)

        const childLogger = logger?.child(invoke.timing).child(ability.key)

        if (diceTiming && internalContext) {
          const rawDice = internalContext as OwnOpponentContext<DicePool>
          const diceCallCtx: DiceContext = {
            own: buildDiceApi(rawDice.own),
            opponent: buildDiceApi(rawDice.opponent),
          }
          ctx.upgradeForCall(state, ability.key, childLogger?.forSide(side))
          inv.call(ctx, freshParams, diceCallCtx)
          decrementUses(state, side, ability.key, freshParams, this)
          ctx.resetAfterCall()
          resultContext = {
            own: diceCallCtx.own.getAll(),
            opponent: diceCallCtx.opponent.getAll(),
          }
        } else {
          ctx.upgradeForCall(state, ability.key, childLogger?.forSide(side))
          const result = inv.call(ctx, freshParams, internalContext)
          if (result !== undefined) resultContext = result
          decrementUses(state, side, ability.key, freshParams, this)
          ctx.resetAfterCall()
        }

        this.flushPendingUnitInvokes()

        childLogger?.forSide(side).log()

        if (source.type === 'config' || source.type === 'deploy') {
          sideTracker.configAbilities.add(invoke)
        } else {
          const key = `${invoke.timing}:${source.unitType}:${ability.key}`
          const invokedIds =
            sideTracker.unitAbilities.get(key) ?? new Set<UnitId>()
          invokedIds.add(source.unitId)
          sideTracker.unitAbilities.set(key, invokedIds)
        }

        if (
          !timingArray.some(t => t === 'BEFORE_ASSIGN_HITS') &&
          state.currentPhase.micro !== 'DICE_ROLL' &&
          state.currentPhase.micro !== 'ASSIGN_HITS' &&
          (state.attacker.hitPools.length > 0 ||
            state.defender.hitPools.length > 0)
        ) {
          this._combatState.assignHits()
        }

        const unitsChanged =
          countAllUnits(state.attacker.units) !== prevAttackerUnitCount ||
          countAllUnits(state.defender.units) !== prevDefenderUnitCount

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
          context: resultContext,
          unitsChanged,
        }
      }
    }

    return null
  }

  private buildInvokes(): void {
    const collections: InvokeCollections = {
      attacker: new Map(),
      defender: new Map(),
    }
    const state = this.state

    for (const side of ['attacker', 'defender'] as const) {
      const sideMap = collections[side]
      const sideConfig = state.abilities[side]
      const unitAbilityKeys = this._unitAbilityKeys[side]

      for (const ability of this._abilities[side]) {
        if (unitAbilityKeys.has(ability.key)) continue
        if (ability.context && ability.context !== state.combatMode) continue

        const configParams = sideConfig[ability.key]
        const mergedParams = configParams
          ? { ...extractDefaults(ability), ...configParams }
          : extractDefaults(ability)

        if ('isEnabled' in mergedParams && !mergedParams.isEnabled) continue

        for (const invoke of ability.invoke) {
          if (
            'uses' in mergedParams &&
            typeof mergedParams.uses === 'number' &&
            mergedParams.uses <= 0
          )
            continue
          // allowExternal DESTROY invokes only make sense as unit abilities
          if (
            ability.allowExternal &&
            (invoke.timing === 'DESTROY' ||
              invoke.timing === 'WHEN_DESTROY' ||
              invoke.timing === 'AFTER_DESTROY')
          )
            continue
          const list = sideMap.get(invoke.timing)
          const entry: TimingInvokeEntry = {
            ability,
            invoke,
            params: mergedParams,
            source: { type: 'config' },
            ownerFaction: this._factionOwnedKeys[side].has(ability.key)
              ? state[side].faction
              : undefined,
          }
          if (list) list.push(entry)
          else sideMap.set(invoke.timing, [entry])
        }
      }

      const unitAbilities = AbilitiesEngine.collectUnitAbilities(state, side)
      const collectedUnitKeys = new Set<string>()
      for (const { ability, unitType, unitId } of unitAbilities) {
        collectedUnitKeys.add(ability.key)
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
            source: { type: 'unit', unitType, unitId },
            ownerFaction: state[side].faction,
          }
          if (list) list.push(entry)
          else sideMap.set(invoke.timing, [entry])
        }
      }

      // Register allowExternal abilities whose unit is not on the field
      for (const ability of this._abilities[side]) {
        if (!unitAbilityKeys.has(ability.key)) continue
        if (!ability.allowExternal) continue
        if (collectedUnitKeys.has(ability.key)) continue
        if (ability.context && ability.context !== state.combatMode) continue

        const configParams = sideConfig[ability.key]
        const mergedParams = configParams
          ? { ...extractDefaults(ability), ...configParams }
          : extractDefaults(ability)

        if ('isEnabled' in mergedParams && !mergedParams.isEnabled) continue

        for (const invoke of ability.invoke) {
          // Skip DESTROY timings — unit is not on the field, can't be destroyed
          if (
            invoke.timing === 'DESTROY' ||
            invoke.timing === 'WHEN_DESTROY' ||
            invoke.timing === 'AFTER_DESTROY'
          )
            continue
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
            ownerFaction: state[side].faction,
          }
          if (list) list.push(entry)
          else sideMap.set(invoke.timing, [entry])
        }
      }

      const deployAbilities = AbilitiesEngine.collectDeployAbilities(
        state,
        side,
      )
      for (const { ability, unitType } of deployAbilities) {
        if (ability.context && ability.context !== state.combatMode) continue
        const configParams = sideConfig[ability.key]
        const mergedParams = configParams
          ? { ...extractDefaults(ability), ...configParams }
          : extractDefaults(ability)

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
            source: { type: 'deploy', unitType },
            ownerFaction: state[side].faction,
          }
          if (list) list.push(entry)
          else sideMap.set(invoke.timing, [entry])
        }
      }
    }

    this._combatState._invokes = collections
    this._combatState._invokesOwned = true
  }

  hasCallableInvoke(timing: AbilityTiming): boolean {
    const invokes = this._combatState._invokes
    const attackerEntries = invokes.attacker.get(timing)
    if (attackerEntries && attackerEntries.length > 0) return true
    const defenderEntries = invokes.defender.get(timing)
    return defenderEntries !== undefined && defenderEntries.length > 0
  }

  queueUnitInvokes(
    side: CombatSide,
    variantKey: string,
    unitIds: UnitId[],
  ): void {
    if (this._pendingUnitInvokes === EMPTY_PENDING) {
      this._pendingUnitInvokes = []
    }
    this._pendingUnitInvokes.push({
      side,
      variantKey,
      unitIds: Array.from(unitIds),
    })
  }

  flushPendingUnitInvokes(): void {
    if (this._pendingUnitInvokes.length === 0) return
    const pending = this._pendingUnitInvokes
    this._pendingUnitInvokes = EMPTY_PENDING
    const state = this._combatState.data
    for (const { side, variantKey, unitIds } of pending) {
      this.appendUnitInvokes(side, state[side], variantKey, unitIds)
    }
  }

  appendUnitInvokes(
    side: CombatSide,
    sideState: SideStateData,
    variantKey: string,
    unitIds: UnitId[],
  ): void {
    const stats = resolveUnitStats(sideState.unitStats, variantKey as UnitType)
    if (!stats?.ABILITIES) return

    this._combatState.ensureOwnInvokes()
    const sideConfig = this.state.abilities[side]
    const sideMap = this._combatState._invokes[side]
    const { type: unitType } = parseVariantId(variantKey as UnitType)

    const idSet = new Set<UnitId>(unitIds)
    for (const [timing, list] of sideMap) {
      const filtered = list.filter(
        e =>
          e.source.type !== 'unit' ||
          !idSet.has((e.source as { unitId: UnitId }).unitId),
      )
      if (filtered.length !== list.length) {
        sideMap.set(timing, filtered)
      }
    }

    for (const ability of stats.ABILITIES) {
      if (ability.context && ability.context !== this.state.combatMode) continue
      const configParams = sideConfig[ability.key]
      const mergedParams = configParams
        ? { ...extractDefaults(ability), ...configParams }
        : extractDefaults(ability)

      for (const invoke of ability.invoke) {
        for (const unitId of unitIds) {
          const entry: TimingInvokeEntry = {
            ability,
            invoke,
            params: mergedParams,
            source: {
              type: 'unit',
              unitType: unitType as UnitBaseType,
              unitId,
            },
            ownerFaction: sideState.faction,
          }
          const list = sideMap.get(invoke.timing)
          if (list) list.push(entry)
          else sideMap.set(invoke.timing, [entry])
        }
      }
    }
  }

  private removeConfigInvokeEntries(
    side: CombatSide,
    abilityKey: string,
    keepIf?: (entry: TimingInvokeEntry) => boolean,
  ): void {
    this._combatState.ensureOwnInvokes()
    const sideMap = this._combatState._invokes[side]
    for (const [timing, entries] of sideMap) {
      const filtered = entries.filter(e => {
        if (
          (e.source.type !== 'config' && e.source.type !== 'deploy') ||
          e.ability.key !== abilityKey
        )
          return true
        return keepIf ? keepIf(e) : false
      })
      if (filtered.length !== entries.length) {
        if (filtered.length === 0) sideMap.delete(timing)
        else sideMap.set(timing, filtered)
      }
    }
  }

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
        ownerFaction: this._factionOwnedKeys[side].has(ability.key)
          ? state[side].faction
          : undefined,
      }
      const list = sideMap.get(invoke.timing)
      if (list) list.push(entry)
      else sideMap.set(invoke.timing, [entry])
    }
  }

  private addDeployAbilityInvokes(
    side: CombatSide,
    ability: Ability,
    unitType: UnitBaseType,
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
        source: { type: 'deploy', unitType },
        ownerFaction: state[side].faction,
      }
      const list = sideMap.get(invoke.timing)
      if (list) list.push(entry)
      else sideMap.set(invoke.timing, [entry])
    }
  }

  syncInvokesForKey(
    side: CombatSide,
    key: string,
    draft: CombatStateData,
  ): void {
    if (this._unitAbilityKeys[side].has(key)) {
      // Unit ability: skip unless allowExternal with unit not on the field
      const ability = this._abilities[side].find(a => a.key === key)
      if (!ability?.allowExternal) return
      const unitAbilities = AbilitiesEngine.collectUnitAbilities(draft, side)
      if (unitAbilities.some(e => e.ability.key === key)) return
      // Fall through: unit not on field, handle as config
    }

    // Check if this is a deploy ability
    const deployAbilities = AbilitiesEngine.collectDeployAbilities(draft, side)
    const deployEntry = deployAbilities.find(d => d.ability.key === key)
    if (deployEntry) {
      this.removeConfigInvokeEntries(side, key)
      const newConfig = draft.abilities[side][key]
      const defaults = extractDefaults(deployEntry.ability)
      const mergedParams = newConfig ? { ...defaults, ...newConfig } : defaults

      if ('isEnabled' in mergedParams && !mergedParams.isEnabled) return

      this.addDeployAbilityInvokes(
        side,
        deployEntry.ability,
        deployEntry.unitType,
        mergedParams,
        draft,
      )
      return
    }

    const ability = this._abilities[side].find(a => a.key === key)
    if (!ability) return

    this.removeConfigInvokeEntries(side, key)

    const newConfig = draft.abilities[side][key]
    const defaults = extractDefaults(ability)
    const mergedParams = newConfig ? { ...defaults, ...newConfig } : defaults

    if ('isEnabled' in mergedParams && !mergedParams.isEnabled) return

    this.addConfigAbilityInvokes(side, ability, mergedParams, draft)
  }

  invokeOnParamSet(
    side: CombatSide,
    targetKey: string,
    changedKeys: string[],
    draft: CombatStateData,
  ): void {
    const ability = this._abilities[side].find(a => a.key === targetKey)
    if (!ability?.onParamSet) return
    const params = draft.abilities[side][targetKey]
    if (!params) return
    for (const key of changedKeys) {
      ability.onParamSet(params, key, params[key])
    }
  }

  private getInvokesForTiming<T extends AbilityTiming>(
    timing: T | T[],
    side: CombatSide,
    triggerSide?: CombatSide,
  ): TimingInvokeEntry[] {
    const timings = Array.isArray(timing) ? timing : [timing]
    const { meta } = this._combatState.data.currentPhase
    const results: TimingInvokeEntry[] = []

    const sideMap = this._combatState._invokes[side]
    for (const t of timings) {
      const entries = sideMap.get(t as AbilityTiming)
      if (!entries) continue
      for (const entry of entries) {
        if (entry.invoke.context) {
          const allowed = Array.isArray(entry.invoke.context)
            ? entry.invoke.context
            : [entry.invoke.context]
          // AFB is part of SPACE_COMBAT, so SPACE_COMBAT context includes AFB
          if (
            !allowed.includes(meta) &&
            !(meta === 'AFB' && allowed.includes('SPACE_COMBAT'))
          )
            continue
        }
        if (triggerSide && entry.invoke.side) {
          if (entry.invoke.side === 'OWN' && side !== triggerSide) continue
          if (entry.invoke.side === 'OPPONENT' && side === triggerSide) continue
        }
        results.push(entry)
      }
    }

    if (results.length > 1) {
      const timingSet = new Set(timings)
      const sideConfig = this._combatState.data.abilities[side]
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
        break
      }
    }

    return results
  }
}
