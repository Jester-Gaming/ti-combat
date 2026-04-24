import type {
  CombatSide,
  FactionKey,
  UnitBaseType,
  UnitId,
  UnitList,
  UnitType,
} from '@/types'

import {
  CombatSideState,
  getOpponentSide,
} from '../combat-side-state/combat-side-state'
import { CombatState } from '../combat-state/combat-state'
import type {
  CombatStateData,
  MetaPhase,
  SideStateData,
} from '../combat-state/types'
import { Logger } from '../logger'
import { resolveUnitStats } from '../utils/resolve-unit-stats'
import { parseVariantId } from '../utils/unit-variant'
import {
  type AbilityBranch,
  AbilityBranchInterrupt,
  AbilityContext,
} from './api/ability-api'
import { extractDefaults } from './declare-param'
import type {
  Ability,
  AbilityInvoke,
  AbilityTiming,
  InternalTimingContextMap,
  OwnOpponentContext,
  SidedContext,
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
  {
    timings: ['END_OF_COMBAT', 'END_OF_COMBAT_ROUND'],
    paramKey: 'endOfCombat',
    label: 'End of Combat (round)',
  },
]

/** Maps each timing to the ABILITY_ORDER param key that governs its ordering.
 *  Timings not in any group resolve in insertion order. */
const SORT_KEY_BY_TIMING = new Map<AbilityTiming, string>()
for (const group of TIMING_GROUPS) {
  for (const t of group.timings) SORT_KEY_BY_TIMING.set(t, group.paramKey)
}

/** Timings whose entries are collected in a "parent" bucket so a single call
 *  (e.g. `runAbilities('START_OF_COMBAT')` in round 1) fires both the parent
 *  abilities and the child round-scoped ones. */
const MERGED_PARENT_BY_TIMING: Partial<Record<AbilityTiming, AbilityTiming>> = {
  START_OF_COMBAT_ROUND: 'START_OF_COMBAT',
}

/** Buckets that are pre-sorted (by ABILITY_ORDER) at build-time and after any
 *  dynamic entry change. */
const PRE_SORTED_BUCKETS: AbilityTiming[] = [
  'START_OF_COMBAT',
  'START_OF_COMBAT_ROUND',
  'END_OF_COMBAT',
  'END_OF_COMBAT_ROUND',
  'BEFORE_ASSIGN_HITS',
]

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

/** Push an entry into the timing bucket. Duplicates round-scoped entries into
 *  their parent bucket (see `MERGED_PARENT_BY_TIMING`) so
 *  `runAbilities(parent)` fires both sets. */
function pushInvokeEntry(
  sideMap: Map<AbilityTiming, TimingInvokeEntry[]>,
  timing: AbilityTiming,
  entry: TimingInvokeEntry,
): void {
  const list = sideMap.get(timing)
  if (list) list.push(entry)
  else sideMap.set(timing, [entry])

  const parent = MERGED_PARENT_BY_TIMING[timing]
  if (parent !== undefined) {
    const parentList = sideMap.get(parent)
    if (parentList) parentList.push(entry)
    else sideMap.set(parent, [entry])
  }
}

/** Sort a bucket in place by the ABILITY_ORDER array for its sort group.
 *  Entries not listed in the order keep their insertion order relative to each
 *  other, after any listed entries. */
function sortBucket(
  entries: TimingInvokeEntry[],
  sideConfig: Record<string, Record<string, unknown>>,
  timing: AbilityTiming,
): void {
  const paramKey = SORT_KEY_BY_TIMING.get(timing)
  if (!paramKey) return
  const orderConfig = sideConfig['ABILITY_ORDER']
  if (!orderConfig) return
  const order = orderConfig[paramKey] as string[] | undefined
  if (!order || order.length === 0) return

  const orderIndex = new Map(order.map((key, i) => [key, i]))
  let nextSlot = order.length
  const sortKey = new Map<TimingInvokeEntry, number>()
  for (const entry of entries) {
    const oi = orderIndex.get(entry.ability.key)
    sortKey.set(entry, oi !== undefined ? oi : nextSlot++)
  }
  entries.sort((a, b) => sortKey.get(a)! - sortKey.get(b)!)
}

/** Re-sort every pre-sorted bucket for a side. Cheap when buckets are small. */
function sortPreSortedBuckets(
  sideMap: Map<AbilityTiming, TimingInvokeEntry[]>,
  sideConfig: Record<string, Record<string, unknown>>,
): void {
  for (const timing of PRE_SORTED_BUCKETS) {
    const entries = sideMap.get(timing)
    if (entries && entries.length > 1) sortBucket(entries, sideConfig, timing)
  }
}

/** Copy-on-write: shallow-copy the liveAbilities path so in-place mutations
 *  don't leak into other branches that share the same liveAbilities object.
 *  Returns the (now owned) live-ability entry for `abilityKey`. */
function cowLiveAbilityEntry(
  draft: CombatStateData,
  side: CombatSide,
  abilityKey: string,
): Record<string, unknown> {
  const sideData = draft[side]
  sideData.liveAbilities = { ...sideData.liveAbilities }
  const entry = sideData.liveAbilities[abilityKey]
  const clone = entry ? { ...entry } : {}
  sideData.liveAbilities[abilityKey] = clone
  return clone
}

/** Decrement `uses` in ability config after a successful invocation.
 *  Writes the new value into `liveAbilities`, leaving `abilities` untouched.
 *  Reads the *current* uses (live overlay → base → pre-call params) so that
 *  abilities that update their own uses inside the call aren't clobbered. */
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
    const live = draft[side].liveAbilities[abilityKey]
    const base = draft[side].abilities[abilityKey]
    const currentUses =
      live && typeof live.uses === 'number'
        ? live.uses
        : base && typeof base.uses === 'number'
          ? base.uses
          : (params.uses as number)
    const entry = cowLiveAbilityEntry(draft, side, abilityKey)
    entry.uses = currentUses - 1
    if (engine) {
      engine.syncInvokesForKey(side, abilityKey, draft)
    }
  }
}

// ── Tracker types ────────────────────────────────────────────────────────

/** Invocation tracker for a single side's abilities */
export interface SideInvocationTracker {
  configAbilities: Set<AbilityInvoke>
  unitAbilities: Map<string, Set<UnitId>> // "timing:unitType:abilityKey" -> Set<UnitId>
}

/** Invocation tracker per side */
export type InvocationTracker = Record<CombatSide, SideInvocationTracker>

/** Snapshot of an in-flight `runAbilities` pass. Stored on the timing
 *  `PhaseStep.frame` slot so the pass resumes from the exact step that
 *  parked it; cloning `pendingSteps` for a branch carries the frame
 *  through automatically. Static fields (timing, options, phase, owner
 *  identity) live on the step itself; this frame holds only the
 *  alternation state. */
export interface AbilityPassFrame {
  tracker: InvocationTracker
  currentSide: CombatSide
  consecutiveSkips: number
}

export interface RunAbilitiesOptions {
  skipSides?: CombatSide[]
  /** Remap `ctx.api.opponent` per invoker side. Used by unit-ability phases
   *  (BOMBARDMENT, AFB, SPACE_CANNON_*) so abilities see "opponent" as their
   *  counterparty in the action — target when firing, firing when targeted —
   *  regardless of actual attacker/defender labels. Enables routed hits (e.g.
   *  Proxima self-bombard) to look natural to abilities like X-89 and Bunker
   *  without making them aware of the routing. */
  opponentSideByInvokerSide?: { attacker: CombatSide; defender: CombatSide }
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

/** Clone an invocation tracker for independent continuation in a branch. */
export function cloneTracker(tracker: InvocationTracker): InvocationTracker {
  return {
    attacker: {
      configAbilities: new Set(tracker.attacker.configAbilities),
      unitAbilities: new Map(
        Array.from(tracker.attacker.unitAbilities, ([k, v]) => [k, new Set(v)]),
      ),
    },
    defender: {
      configAbilities: new Set(tracker.defender.configAbilities),
      unitAbilities: new Map(
        Array.from(tracker.defender.unitAbilities, ([k, v]) => [k, new Set(v)]),
      ),
    },
  }
}

/** Snapshot of the pieces we need to restore after swapping to a branch. */
interface BranchStateSnapshot {
  data: CombatStateData
  invokes: InvokeCollections
  invokesOwned: boolean
  logger?: Logger
}

/**
 * Simulation-only ability engine.
 *
 * Has a direct bidirectional link with CombatState — reads and writes
 * ability config through CombatState.data[side].abilities. Abilities
 * mutate the shared Mutative draft on CombatState.data directly.
 */
export class AbilitiesEngine {
  private _combatState!: CombatState
  private _abilities!: Record<CombatSide, Ability[]>
  private _unitAbilityKeys!: Record<CombatSide, ReadonlySet<string>>
  private _factionOwnedKeys!: Record<CombatSide, ReadonlySet<string>>
  private _attackerCtx!: AbilityContext
  private _defenderCtx!: AbilityContext

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
    this._pendingUnitInvokes = EMPTY_PENDING
  }

  /** Capture current engine/combatState state so it can be restored after
   *  processing a branch. */
  _saveBranchState(): BranchStateSnapshot {
    return {
      data: this._combatState.data,
      invokes: this._combatState._invokes,
      invokesOwned: this._combatState._invokesOwned,
      logger: this._logger,
    }
  }

  /** Swap engine/combatState to a given branch's data/invokes/logger.
   *  Sibling branches from the same rollDice call may share the same `invokes`
   *  reference (if the rollDice callback didn't trigger a COW). We mark the
   *  invokes as unowned so the next mutation triggers `ensureOwnInvokes` and
   *  isolates this branch's mutations from its siblings. */
  _setBranchState(branch: AbilityBranch): void {
    this._combatState.data = branch.data
    this._combatState._invokes = branch.invokes
    this._combatState._invokesOwned = false
    this._logger = branch.logger
  }

  /** Restore state captured by _saveBranchState. */
  _restoreBranchState(snap: BranchStateSnapshot): void {
    this._combatState.data = snap.data
    this._combatState._invokes = snap.invokes
    this._combatState._invokesOwned = snap.invokesOwned
    this._logger = snap.logger
  }

  // ── Read accessors ──────────────────────────────────────────────────

  get attackerFaction(): FactionKey {
    return this.state.attacker.faction
  }

  get defenderFaction(): FactionKey {
    return this.state.defender.faction
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
  hasDestroyAbilities(invokes?: InvokeCollections): boolean {
    invokes ??= this._combatState._invokes
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

    const collect = (pool: UnitList) => {
      for (const id of pool) {
        const key = sideState.unitType[id]
        if (!key) continue
        const stats = resolveUnitStats(sideState.unitStats, key)
        if (!stats?.ABILITIES) continue
        const { type: unitType } = parseVariantId(key)

        for (const ability of stats.ABILITIES) {
          entries.push({
            ability,
            unitType: unitType as UnitBaseType,
            unitId: id as UnitId,
          })
        }
      }
    }
    collect(sideState.participatingUnits)
    collect(sideState.nonParticipatingUnits)
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
    timing: T,
    context?: TimingContextMap[T],
    options?: RunAbilitiesOptions,
    logger?: Logger,
  ): void {
    // The dispatching timing step (and its phase stack) comes from the
    // combat state. When omitted (e.g. PREPARE pass, test-driven call),
    // `currentStep` is undefined — context-filtered invokes are skipped
    // and there's no frame to park into.
    const step = this._combatState.currentStep

    // Resume from the step's frame if one was parked. Consume it here —
    // if the pass parks again or branches, a new frame will be written.
    const resume = step?.frame
    if (step && resume) step.frame = undefined

    if (!resume && !this.hasCallableInvoke(timing)) return

    const activeLogger = logger ?? this._logger

    const tracker: InvocationTracker = resume?.tracker ?? {
      attacker: {
        configAbilities: new Set(),
        unitAbilities: new Map(),
      },
      defender: {
        configAbilities: new Set(),
        unitAbilities: new Map(),
      },
    }

    this._runAbilityLoop(
      timing,
      tracker,
      resume?.currentSide ?? 'attacker',
      resume?.consecutiveSkips ?? 0,
      context,
      options,
      activeLogger,
    )
  }

  /**
   * Core alternation loop for runAbilities. Alternates sides resolving one
   * ability at a time until both sides skip consecutively. tryResolveOne
   * pre-stamps the dispatching step's `.frame` before calling the ability
   * so any branches produced inside the call (via `ctx.rollDice`) inherit
   * the correct resume frame through `clonePendingSteps`. On a normal
   * 'ran' tryResolveOne clears the frame; on 'parked' it leaves the frame
   * set, and on branch (AbilityBranchInterrupt) the outer step is
   * abandoned along with its state. The loop itself only has to re-throw
   * the interrupt.
   */
  private _runAbilityLoop<T extends AbilityTiming>(
    timing: T,
    tracker: InvocationTracker,
    startSide: CombatSide,
    consecutiveSkips: number,
    context: TimingContextMap[T] | undefined,
    options?: RunAbilitiesOptions,
    logger?: Logger,
  ): void {
    let currentSide: CombatSide = startSide

    while (consecutiveSkips < 2) {
      if (options?.skipSides?.includes(currentSide)) {
        consecutiveSkips += 1
        currentSide = getOpponentSide(currentSide)
        continue
      }

      const result = this.tryResolveOne(
        timing,
        currentSide,
        context,
        tracker,
        logger,
        options?.opponentSideByInvokerSide,
      )

      if (result === 'parked') return

      if (result === 'ran') {
        consecutiveSkips = 0
      } else {
        consecutiveSkips += 1
      }

      currentSide = getOpponentSide(currentSide)
    }
  }

  // ── Private execution engine methods ──────────────────────────────

  /**
   * Try to resolve the next applicable ability for `side`.
   * @returns `'ran'` if an ability was called, `'skipped'` if none applied,
   *   `'parked'` if the call pushed a new timing step via `ctx.trigger`
   *   (caller yields control to the script; the dispatching step's
   *   `.frame` has been populated).
   * @throws AbilityBranchInterrupt if the call produced branches. Before
   *   calling, `step.frame` is pre-stamped with the post-invoke tracker
   *   and resume side so per-branch clones of `pendingSteps` inherit the
   *   correct frame via `clonePendingSteps`.
   */
  private tryResolveOne<T extends AbilityTiming>(
    timing: T,
    side: CombatSide,
    context: TimingContextMap[T] | undefined,
    tracker: InvocationTracker,
    logger?: Logger,
    opponentSideByInvokerSide?: {
      attacker: CombatSide
      defender: CombatSide
    },
  ): 'ran' | 'skipped' | 'parked' {
    const state = this._combatState.data
    const step = this._combatState.currentStep
    const phase = step?.phase
    const invokes = this.getInvokesForTiming(timing, side, phase)

    const sideTracker = tracker[side]

    const isDestroyTiming =
      timing === 'DESTROY' ||
      timing === 'WHEN_DESTROY' ||
      timing === 'AFTER_DESTROY'

    let destroyedForSide: Set<UnitId> | undefined
    if (isDestroyTiming && context) {
      const sided = context as SidedContext<Record<UnitType, UnitId[]>>
      destroyedForSide = new Set()
      for (const ids of Object.values(sided[side])) {
        for (const id of ids) destroyedForSide.add(id)
      }
    }

    for (const { ability, invoke, params, source, ownerFaction } of invokes) {
      // Check if already invoked
      if (source.type === 'config') {
        if (sideTracker.configAbilities.has(invoke)) {
          continue
        }
      } else if (source.type === 'deploy') {
        if (sideTracker.configAbilities.has(invoke)) continue
        if (
          CombatSideState.isRestricted(
            state,
            side,
            'lost',
            'DEPLOY',
            source.unitType,
          )
        )
          continue
        if (
          CombatSideState.isRestricted(
            state,
            side,
            'cannotBeUsed',
            'DEPLOY',
            source.unitType,
          )
        )
          continue
      } else if (source.type === 'unit') {
        const sideStateData = state[side]
        const unitKey = sideStateData.unitType[source.unitId]
        const unitAlive =
          !!unitKey &&
          parseVariantId(unitKey).type === source.unitType &&
          (sideStateData.participatingUnits.includes(source.unitId) ||
            sideStateData.nonParticipatingUnits.includes(source.unitId))

        // Self-targeted unit trigger: the timing's context is the invoke's
        // own unit id. This is the unit reacting to its own event (retreat,
        // sustain, etc.) — allow it to fire even if the unit has since been
        // removed from the field (e.g. WHEN_RETREAT after the unit is pulled).
        const isSelfUnitTrigger =
          typeof context === 'string' && (context as UnitId) === source.unitId

        if (isDestroyTiming) {
          if (unitAlive) continue
          if (!destroyedForSide?.has(source.unitId)) continue
        } else if (!unitAlive && !isSelfUnitTrigger) {
          continue
        }

        const key = `${invoke.timing}:${source.unitType}:${ability.key}`
        const invokedIds = sideTracker.unitAbilities.get(key)
        if (invokedIds?.has(source.unitId)) {
          continue
        }
      }

      const liveOverlay = state[side].liveAbilities[ability.key]
      const freshParams = liveOverlay ? { ...params, ...liveOverlay } : params

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

      const unitSource = source.type === 'unit' ? source.unitId : undefined

      if ('isEnabled' in freshParams && !freshParams.isEnabled) continue
      if (
        !invoke.system &&
        'uses' in freshParams &&
        typeof freshParams.uses === 'number' &&
        freshParams.uses <= 0
      )
        continue

      const ctx = this.context(side)
      ctx.unitSource = unitSource
      ctx.ownerFaction = ownerFaction
      ctx.ability = ability

      // Rebind ctx.api.opponent if the caller passed a role-based remap
      // (used for unit-ability phases so abilities see opponent = target when
      // firing, or opponent = firing when targeted).
      const remappedOpponent = opponentSideByInvokerSide?.[side]
      const priorOpponentSide =
        remappedOpponent !== undefined
          ? ctx.api.opponent._rebindSide(remappedOpponent)
          : undefined

      try {
        let canCall: boolean
        if (inv.isCallable) {
          canCall = inv.isCallable(freshParams, ctx, internalContext)
        } else {
          canCall = true
        }

        if (canCall) {
          const childLogger = logger?.child(invoke.timing).child(ability.key)

          const markTracker = (t: InvocationTracker) => {
            const st = t[side]
            if (source.type === 'config' || source.type === 'deploy') {
              st.configAbilities.add(invoke)
            } else {
              const key = `${invoke.timing}:${source.unitType}:${ability.key}`
              const invokedIds = st.unitAbilities.get(key) ?? new Set<UnitId>()
              invokedIds.add(source.unitId)
              st.unitAbilities.set(key, invokedIds)
            }
          }

          const shouldDecrementUses = !invoke.system
          ctx.upgradeForCall(ability, childLogger?.forSide(side))

          // Pre-stamp the dispatching step's frame with the post-invoke
          // resume state. If the call branches, `clonePendingSteps` deep-
          // clones this frame per branch (with its own `cloneTracker`) so
          // every branch resumes from the correct point. If the call
          // completes normally, we clear the frame below.
          //
          // Parking requires `preScriptLen > 0`: at the top level (initial
          // PREPARE or a test-driven `runAbilities`) there's no outer step
          // to come back to. We still pre-stamp for branch propagation;
          // the final step.frame is cleared on non-parked completion.
          const frameTracker = step ? cloneTracker(tracker) : undefined
          if (step && frameTracker) {
            markTracker(frameTracker)
            step.frame = {
              tracker: frameTracker,
              currentSide: getOpponentSide(side),
              consecutiveSkips: 0,
            }
          }
          // Also mark the outer loop's tracker so the current pass
          // alternation (if we continue without branching/parking) treats
          // this ability as invoked.
          markTracker(tracker)

          try {
            inv.call(ctx, freshParams, internalContext)
            if (shouldDecrementUses)
              decrementUses(state, side, ability.key, freshParams, this)
            ctx.resetAfterCall()
          } catch (e) {
            if (!(e instanceof AbilityBranchInterrupt)) {
              if (step) step.frame = undefined
              throw e
            }

            ctx.resetAfterCall()

            for (const branch of e.branches) {
              const saved = this._saveBranchState()
              this._setBranchState(branch)

              if (shouldDecrementUses)
                decrementUses(branch.data, side, ability.key, freshParams, this)
              this.flushPendingUnitInvokes()
              branch.logger?.forSide(side).log()

              this._restoreBranchState(saved)
            }

            throw new AbilityBranchInterrupt(e.branches)
          }

          this.flushPendingUnitInvokes()

          childLogger?.forSide(side).log()

          // Parked when the dispatching step is no longer on top — either a
          // trigger was pushed above it (ctx.trigger, destroy cascade) or the
          // script was dropped out from under us (ctx.transitionTo). Top-level
          // passes (step === undefined) can't park: pushed steps sit on
          // `pendingSteps` and run on the next `advance()`.
          const parked =
            step !== undefined && this._combatState.currentStep !== step

          if (!parked && step) step.frame = undefined
          return parked ? 'parked' : 'ran'
        }
      } finally {
        if (priorOpponentSide !== undefined) {
          ctx.api.opponent._rebindSide(priorOpponentSide)
        }
      }
    }

    return 'skipped'
  }

  private buildInvokes(): void {
    const collections: InvokeCollections = {
      attacker: new Map(),
      defender: new Map(),
    }
    const state = this.state

    for (const side of ['attacker', 'defender'] as const) {
      const sideMap = collections[side]
      const unitAbilityKeys = this._unitAbilityKeys[side]
      const sideData = state[side]

      for (const ability of this._abilities[side]) {
        if (unitAbilityKeys.has(ability.key)) continue
        if (ability.context && ability.context !== state.combatMode) continue

        const configParams = CombatSideState.getLiveParams(
          sideData,
          ability.key,
        )
        const mergedParams = configParams
          ? { ...extractDefaults(ability), ...configParams }
          : extractDefaults(ability)

        if ('isEnabled' in mergedParams && !mergedParams.isEnabled) continue

        for (const invoke of ability.invoke) {
          if (
            !invoke.system &&
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
          pushInvokeEntry(sideMap, invoke.timing, {
            ability,
            invoke,
            params: mergedParams,
            source: { type: 'config' },
            ownerFaction: this._factionOwnedKeys[side].has(ability.key)
              ? state[side].faction
              : undefined,
          })
        }
      }

      const unitAbilities = AbilitiesEngine.collectUnitAbilities(state, side)
      const collectedUnitKeys = new Set<string>()
      for (const { ability, unitType, unitId } of unitAbilities) {
        collectedUnitKeys.add(ability.key)
        if (ability.context && ability.context !== state.combatMode) continue
        const configParams = CombatSideState.getLiveParams(
          sideData,
          ability.key,
        )
        const mergedParams = configParams
          ? { ...extractDefaults(ability), ...configParams }
          : extractDefaults(ability)

        for (const invoke of ability.invoke) {
          pushInvokeEntry(sideMap, invoke.timing, {
            ability,
            invoke,
            params: mergedParams,
            source: { type: 'unit', unitType, unitId },
            ownerFaction: state[side].faction,
          })
        }
      }

      // Register allowExternal abilities whose unit is not on the field
      for (const ability of this._abilities[side]) {
        if (!unitAbilityKeys.has(ability.key)) continue
        if (!ability.allowExternal) continue
        if (collectedUnitKeys.has(ability.key)) continue
        if (ability.context && ability.context !== state.combatMode) continue

        const configParams = CombatSideState.getLiveParams(
          sideData,
          ability.key,
        )
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
            !invoke.system &&
            'uses' in mergedParams &&
            typeof mergedParams.uses === 'number' &&
            mergedParams.uses <= 0
          )
            continue
          pushInvokeEntry(sideMap, invoke.timing, {
            ability,
            invoke,
            params: mergedParams,
            source: { type: 'config' },
            ownerFaction: state[side].faction,
          })
        }
      }

      const deployAbilities = AbilitiesEngine.collectDeployAbilities(
        state,
        side,
      )
      for (const { ability, unitType } of deployAbilities) {
        if (ability.context && ability.context !== state.combatMode) continue
        const configParams = CombatSideState.getLiveParams(
          sideData,
          ability.key,
        )
        const mergedParams = configParams
          ? { ...extractDefaults(ability), ...configParams }
          : extractDefaults(ability)

        if ('isEnabled' in mergedParams && !mergedParams.isEnabled) continue

        for (const invoke of ability.invoke) {
          if (
            !invoke.system &&
            'uses' in mergedParams &&
            typeof mergedParams.uses === 'number' &&
            mergedParams.uses <= 0
          )
            continue
          pushInvokeEntry(sideMap, invoke.timing, {
            ability,
            invoke,
            params: mergedParams,
            source: { type: 'deploy', unitType },
            ownerFaction: state[side].faction,
          })
        }
      }

      sortPreSortedBuckets(sideMap, state[side].abilities)
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
    const state = this.state
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
      if (ability.context && ability.context !== state.combatMode) continue
      const configParams = CombatSideState.getLiveParams(sideState, ability.key)
      const mergedParams = configParams
        ? { ...extractDefaults(ability), ...configParams }
        : extractDefaults(ability)

      for (const invoke of ability.invoke) {
        for (const unitId of unitIds) {
          pushInvokeEntry(sideMap, invoke.timing, {
            ability,
            invoke,
            params: mergedParams,
            source: {
              type: 'unit',
              unitType: unitType as UnitBaseType,
              unitId,
            },
            ownerFaction: sideState.faction,
          })
        }
      }
    }

    sortPreSortedBuckets(sideMap, state[side].abilities)
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
        !invoke.system &&
        'uses' in mergedParams &&
        typeof mergedParams.uses === 'number' &&
        mergedParams.uses <= 0
      )
        continue
      pushInvokeEntry(sideMap, invoke.timing, {
        ability,
        invoke,
        params: mergedParams,
        source: { type: 'config' },
        ownerFaction: this._factionOwnedKeys[side].has(ability.key)
          ? state[side].faction
          : undefined,
      })
    }
    sortPreSortedBuckets(sideMap, state[side].abilities)
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
        !invoke.system &&
        'uses' in mergedParams &&
        typeof mergedParams.uses === 'number' &&
        mergedParams.uses <= 0
      )
        continue
      pushInvokeEntry(sideMap, invoke.timing, {
        ability,
        invoke,
        params: mergedParams,
        source: { type: 'deploy', unitType },
        ownerFaction: state[side].faction,
      })
    }
    sortPreSortedBuckets(sideMap, state[side].abilities)
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
      const newConfig = CombatSideState.getLiveParams(draft[side], key)
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

    const newConfig = CombatSideState.getLiveParams(draft[side], key)
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
    // Give onParamSet a mutable merged view. It writes derived fields back
    // (e.g. ships → nonFighterShips/spaceCombatParticipating). Capture any
    // mutations via a before/after diff and persist them in liveAbilities
    // so subsequent reads see the derived values.
    const params = { ...CombatSideState.getLiveParams(draft[side], targetKey) }
    const before = { ...params }
    for (const key of changedKeys) {
      ability.onParamSet(params, key, params[key])
    }
    let liveEntry: Record<string, unknown> | undefined
    for (const key of Object.keys(params)) {
      if (params[key] !== before[key]) {
        if (!liveEntry) liveEntry = cowLiveAbilityEntry(draft, side, targetKey)
        liveEntry[key] = params[key]
      }
    }
  }

  private getInvokesForTiming<T extends AbilityTiming>(
    timing: T,
    side: CombatSide,
    phase?: MetaPhase[],
  ): TimingInvokeEntry[] {
    const entries = this._combatState._invokes[side].get(timing)
    if (!entries) return []

    const activePhase = phase ?? []
    const results: TimingInvokeEntry[] = []
    for (const entry of entries) {
      if (entry.invoke.context) {
        const allowed = Array.isArray(entry.invoke.context)
          ? entry.invoke.context
          : [entry.invoke.context]
        // Match if any active phase (outer→inner stack) is in the invoke's
        // allowed contexts. E.g. AFB nested inside SPACE_COMBAT has active
        // phase ['SPACE_COMBAT', 'AFB'], so abilities scoped to either meta
        // fire.
        if (!activePhase.some(p => allowed.includes(p))) continue
      }
      results.push(entry)
    }
    return results
  }
}
