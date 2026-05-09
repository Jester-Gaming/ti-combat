import type { UnitCategory } from '@/constants/units'
import { enforceFleetPool } from '@/data/abilities/advanced/fleet-pool'
import type {
  CombatSide,
  DiceGroup,
  FactionKey,
  SourcedDiceGroup,
  UnitAbility,
  UnitBaseType,
  UnitId,
  UnitState,
  UnitStats,
  UnitType,
  UnitVariantId,
} from '@/types'

import {
  CombatSideState,
  getOpponentSide,
} from '../../combat-side-state/combat-side-state'
import {
  buildDestroyGroup,
  clonePendingSteps,
  cloneStateForBranch,
} from '../../combat-state/combat-state'
import type {
  CombatMode,
  CombatStateData,
  HitPool,
  MetaPhase,
  PendingStep,
  SideStateData,
  UnitAbilityMeta,
} from '../../combat-state/types'
import { isDiceRollContext } from '../../combat-state/types'
import { getDiceOutcomes } from '../../combat-state/utils'
import type { Logger } from '../../logger'
import { canonicalizeUnitState } from '../../utils/canonicalize-unit-state'
import type {
  AbilitiesEngine,
  AbilityCandidate,
  InvokeCollections,
} from '../abilities-engine'
import type {
  Ability,
  AbilityBaseParams,
  AbilityTiming,
  DicePool,
  OwnOpponentContext,
  RuntimeAbilityList,
  SidedDiceData,
} from '../types'
import { type AbilityUtils, abilityUtils } from './ability-utils'

// ============================================================================
// BRANCH TYPES
// ============================================================================

export interface AbilityBranch {
  data: CombatStateData
  invokes: InvokeCollections
  allInvokes: Record<CombatSide, AbilityCandidate[]>
  probability: number
  logger?: Logger
  /** The `pendingSteps` continuation this branch should resume with. Carried
   *  so branches that pushed script state (e.g. destroy-cascade groups from
   *  `destroyUnits` inside a rollDice callback) don't lose that state when
   *  they propagate up through `AbilityBranchInterrupt`. Optional for call
   *  sites that have no script state to forward. */
  pendingSteps?: PendingStep[]
}

/** Control-flow mechanism (not an Error — no stack trace overhead). */
export class AbilityBranchInterrupt {
  branches: AbilityBranch[]
  constructor(branches: AbilityBranch[]) {
    this.branches = branches
  }
}

// ============================================================================
// PARTICIPATION RESYNC
// ============================================================================

/** Keys whose changes alter which base types participate in the
 *  current combat mode. Only `updateAbilityConfig` writes that touch
 *  these trigger a participating/non-participating re-split. */
const SETTINGS_PARTICIPATION_KEYS = new Set([
  'ships',
  'groundForces',
  'spaceCombatParticipating',
  'groundCombatParticipating',
])
const UNIT_PRIORITY_PARTICIPATION_KEYS = new Set([
  'spaceUnitPriority',
  'groundUnitPriority',
])

function affectsParticipating(
  abilityKey: string,
  updatedKeys: readonly string[],
): boolean {
  const set =
    abilityKey === 'SETTINGS'
      ? SETTINGS_PARTICIPATION_KEYS
      : abilityKey === 'UNIT_PRIORITY'
        ? UNIT_PRIORITY_PARTICIPATION_KEYS
        : undefined
  if (!set) return false
  for (const k of updatedKeys) if (set.has(k)) return true
  return false
}

// ============================================================================
// SIDE API
// ============================================================================

export class SideApi {
  private _side: CombatSide
  private _ctx!: AbilityContext
  _abilityKey?: string
  _abilitiesParams?: AbilitiesEngine

  constructor(side: CombatSide, ctx: AbilityContext) {
    this._side = side
    this._ctx = ctx
  }

  /** Temporarily rebind this SideApi to a different side and return the
   *  previous side (for restoration). Used by the engine to implement
   *  "mimic side" semantics in unit-ability phases. Not intended for
   *  ability authors. */
  _rebindSide(side: CombatSide): CombatSide {
    const prev = this._side
    this._side = side
    return prev
  }

  private get _sideData(): SideStateData {
    return this._ctx.state[this._side]
  }

  private get state(): CombatStateData {
    return this._ctx.state
  }

  getFaction() {
    return this.state[this._side].faction
  }

  getUnits(unitType: UnitType, options?: { includeVariants: true }) {
    return CombatSideState.getUnits(
      this._sideData,
      unitType,
      options?.includeVariants,
    )
  }

  hasUnit(unitId: UnitId) {
    return CombatSideState.hasUnit(this._sideData, unitId)
  }

  hasUnitType(unitType: UnitType, options?: { includeVariants: true }) {
    return CombatSideState.hasUnitType(
      this._sideData,
      unitType,
      options?.includeVariants,
    )
  }

  countUnits(
    filter?: UnitType | UnitType[],
    options?: { includeVariants: true },
  ) {
    return CombatSideState.countUnits(
      this._sideData,
      filter,
      options?.includeVariants,
    )
  }

  getPendingHits(filter?: { base?: true; bonus?: true }) {
    return CombatSideState.getPendingHits(this._sideData, filter)
  }

  getHitPoolValidTargets() {
    return CombatSideState.getHitPoolValidTargets(this._sideData)
  }

  getActiveBaseTypes() {
    return CombatSideState.getActiveBaseTypes(this._sideData)
  }

  getParticipatingUnitTypes(options?: { combatMode?: CombatMode }) {
    return CombatSideState.getParticipatingUnitTypes(
      this._sideData,
      options?.combatMode ?? this.state.combatMode,
    )
  }

  getUnitVariantsOptions(filter?: {
    include?: UnitType[]
    exclude?: UnitType[]
    excludeSubtypes?: UnitVariantId[]
    excludeSubtypeSource?: string[]
    includeSubtypes?: UnitVariantId[]
    combatMode?: CombatMode
    includeNonParticipating?: boolean
    includeOnlyBaseTypes?: boolean
  }) {
    return CombatSideState.getUnitVariantOptions(
      this._sideData,
      this.state.combatMode,
      filter,
    )
  }

  findUnitByPriority(priority: UnitType[]): UnitId | undefined
  findUnitByPriority(priority: UnitType[], amount: number): UnitId[]
  findUnitByPriority(
    priority: UnitType[],
    amount?: number,
  ): UnitId | UnitId[] | undefined {
    const participating = new Set(
      CombatSideState.getParticipatingUnitTypes(
        this._sideData,
        this.state.combatMode,
      ),
    )
    if (amount !== undefined) {
      return CombatSideState.findUnitByPriority(
        this._sideData,
        priority,
        participating,
        amount,
      )
    }
    return CombatSideState.findUnitByPriority(
      this._sideData,
      priority,
      participating,
    )
  }

  /** Simulate resolving a HitPool against this side's current units —
   *  returns the UnitIds that would be destroyed, in sacrifice order.
   *  Non-destructive. */
  getAssignHitsTargets(hitPool: HitPool): UnitId[] {
    const dirty = this._sideData._needsCanonicalize
    if (dirty) {
      canonicalizeUnitState(this._sideData, dirty)
    }
    return CombatSideState.getAssignHitsTargets(this._sideData, hitPool)
  }

  getUnitStats(unitTypeOrId: string | UnitId) {
    return CombatSideState.getUnitStats(this._sideData, unitTypeOrId)
  }

  getVariantKey(unitId: UnitId) {
    return CombatSideState.findVariantKey(this._sideData, unitId) || undefined
  }

  getUnitState(unitId: UnitId) {
    return CombatSideState.getUnitState(this._sideData, unitId)
  }

  getUnitBaseType(unitId: UnitId) {
    return CombatSideState.getUnitBaseType(this._sideData, unitId)
  }

  getUnitVariant(unitId: UnitId) {
    return CombatSideState.getUnitVariant(this._sideData, unitId)
  }

  isUnitAbilityLost(ability: UnitAbility, unitType: UnitType) {
    return CombatSideState.isRestricted(
      this.state,
      this._side,
      'lost',
      ability,
      unitType,
    )
  }

  isUnitAbilityCannotBeUsed(ability: UnitAbility, unitType: UnitType) {
    return CombatSideState.isRestricted(
      this.state,
      this._side,
      'cannotBeUsed',
      ability,
      unitType,
    )
  }

  /** Remove this `(unitId, abilityKey)` pair from `_invokes` on this side.
   *  Intended for self-pruning from `isCallable` when a stable
   *  disqualification (e.g. damaged, ability lost) is detected. Idempotent.
   *  Safe to call during ability iteration. */
  disableUnitAbility(unitId: UnitId, abilityKey: string): void {
    this._ctx._abilitiesParams.disableUnitAbility(
      this._side,
      unitId,
      abilityKey,
    )
  }

  /** Re-register a previously disabled `(unitId, abilityKey)` entry.
   *  Used by abilities that restore a previously-unavailable ability on a
   *  unit (e.g. Duranium Armor repairing a damaged ship). Idempotent. */
  enableUnitAbility(unitId: UnitId, abilityKey: string): void {
    this._ctx._abilitiesParams.enableUnitAbility(this._side, unitId, abilityKey)
  }

  getAbilityConfig<K extends keyof AbilityConfigMap>(
    key: K,
  ): AbilityBaseParams & AbilityConfigMap[K]
  getAbilityConfig(key: string) {
    return CombatSideState.getLiveParams(this._sideData, key)
  }

  /** Destroy one or more units and fire DESTROY/WHEN_DESTROY/AFTER_DESTROY
   *  exactly once for the combined set (simultaneous destruction). */
  destroyUnits(target: UnitBaseType | UnitId | UnitId[]): void {
    const s = this._sideData
    const destroyed: UnitId[] = []

    if (target === undefined) {
      return
    } else if (Array.isArray(target)) {
      for (const id of target) {
        if (!CombatSideState.findVariantKey(s, id)) continue
        destroyed.push(id)
      }
    } else if (target.length > 1) {
      // UnitId is a single-char packed token; UnitBaseType is a
      // multi-char tag like "CRUISER". Distinguish by length.
      const found = CombatSideState.findFirstUnitId(s, target as UnitBaseType)
      if (!found) return
      destroyed.push(found.unitId)
    } else {
      const unitId = target as UnitId
      if (!CombatSideState.findVariantKey(s, unitId)) return
      destroyed.push(unitId)
    }

    if (destroyed.length === 0) return
    CombatSideState.removeUnits(s, destroyed)

    if (this._abilitiesParams) {
      this._ctx.runDestroyAbilities(destroyed)
    }
  }

  removeUnits(target: UnitBaseType | UnitId | UnitId[]): void {
    CombatSideState.removeUnits(this._sideData, target)
  }

  placeUnits(
    unitsToAdd: Partial<Record<UnitType, number>>,
  ): Record<UnitType, UnitId[]> {
    const placed = CombatSideState.placeUnits(
      this._sideData,
      this.state.combatMode,
      unitsToAdd,
      this.state,
    )

    const abilitiesParams = this._abilitiesParams
    if (abilitiesParams) {
      for (const [variantKey, newIds] of Object.entries(placed)) {
        abilitiesParams.addUnitInvokes(this._side, variantKey, newIds)
      }
      // placeUnits appends to the tail of participatingUnits; resort so the
      // configured UNIT_PRIORITY governs hit assignment for the new units.
      abilitiesParams.combatState.resyncParticipating(this._side)
    }
    enforceFleetPool(this)
    return placed as Record<UnitType, UnitId[]>
  }

  modifyUnitType(key: UnitType, updates: Partial<UnitStats>): void {
    const { keysWithAbilitiesChange } = CombatSideState.modifyUnitType(
      this._sideData,
      key,
      updates,
    )

    const abilitiesParams = this._abilitiesParams
    if (abilitiesParams) {
      for (const { key: vKey, ids } of keysWithAbilitiesChange) {
        abilitiesParams.addUnitInvokes(this._side, vKey, ids)
      }
    }
  }

  modifyUnitState(unitId: UnitId, updates: Partial<UnitState>): void {
    CombatSideState.modifyUnitState(this._sideData, unitId, updates)
  }

  /** Mark the side's unitState as needing canonicalization. The actual
   *  state-value permutation is deferred — applied just before hits
   *  resolve, or eagerly when an API consumer (`getAssignHitsTargets`)
   *  needs current order. Coalesces multiple marks per phase into one
   *  pass. Currently called by Duranium after marking `usedSustainThisRound`,
   *  which makes same-variant peers diverge in destroyScore. */
  resortUnits(unitId: UnitId): void {
    const type = this._sideData.unitType[unitId]
    if (!type) return
    const set = this._sideData._needsCanonicalize ?? new Set<UnitType>()
    set.add(type)
    this._sideData._needsCanonicalize = set
  }

  reduceHits(amount: number) {
    CombatSideState.reduceHits(this._sideData, amount)
  }

  addHits(hits: number, validTargets: UnitType[]) {
    const data = this.state
    const wasEmpty =
      data.attacker.hitPools.length === 0 && data.defender.hitPools.length === 0
    CombatSideState.addHits(this._sideData, hits, validTargets)
    if (wasEmpty) this._ctx._assignHits()
  }

  setUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ) {
    CombatSideState.addRestriction(
      this.state,
      this._side,
      'lost',
      ability,
      reason,
      target,
    )
  }

  removeUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ) {
    CombatSideState.removeRestriction(
      this.state,
      this._side,
      'lost',
      ability,
      reason,
      target,
    )
  }

  setUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ) {
    CombatSideState.addRestriction(
      this.state,
      this._side,
      'cannotBeUsed',
      ability,
      reason,
      target,
    )
  }

  removeUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ) {
    CombatSideState.removeRestriction(
      this.state,
      this._side,
      'cannotBeUsed',
      ability,
      reason,
      target,
    )
  }

  addSubtype(variantId: UnitType, subtype: UnitVariantId) {
    const moved = CombatSideState.addSubtype(this._sideData, variantId, subtype)
    if (!moved) return
    // Re-register invokes for the new variant so the unit's ABILITIES set
    // matches its variant stats and per-ability `sort` runs against the
    // current variant key. Mirrors `modifyUnitType` / `placeUnits`.
    this._abilitiesParams?.addUnitInvokes(this._side, moved.newKey, [
      moved.unitId,
    ])
  }

  removeSubtype(variantId: UnitType, subtype: UnitVariantId) {
    CombatSideState.removeSubtype(this._sideData, variantId, subtype)
  }

  updateAbilityConfig(
    keyOrUpdates: string | Record<string, unknown>,
    maybeUpdates?: Record<string, unknown>,
  ) {
    const state = this.state
    const side = this._side

    let targetKey: string
    let updates: Record<string, unknown>

    if (typeof keyOrUpdates === 'string') {
      targetKey = keyOrUpdates
      updates = maybeUpdates!
    } else {
      targetKey = this._abilityKey!
      updates = keyOrUpdates
    }

    const sideData = state[side]
    const baseEntry = sideData.abilities[targetKey]
    const oldLiveEntry = sideData.liveAbilities[targetKey]

    const oldIsEnabled =
      oldLiveEntry && 'isEnabled' in oldLiveEntry
        ? oldLiveEntry.isEnabled
        : baseEntry?.isEnabled
    const oldUses =
      oldLiveEntry && 'uses' in oldLiveEntry
        ? oldLiveEntry.uses
        : baseEntry?.uses

    // COW: shallow-copy the liveAbilities path so mutations don't leak
    // into other branches sharing the same liveAbilities object.
    sideData.liveAbilities = { ...sideData.liveAbilities }
    const liveSideConfig = sideData.liveAbilities
    liveSideConfig[targetKey] = oldLiveEntry ? { ...oldLiveEntry } : {}
    const liveEntry = liveSideConfig[targetKey]

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'function') {
        const currentValue =
          key in liveEntry ? liveEntry[key] : baseEntry?.[key]
        liveEntry[key] = value(currentValue)
      } else {
        liveEntry[key] = value
      }
    }

    const abilitiesParams = this._abilitiesParams
    if (abilitiesParams) {
      const newIsEnabled =
        'isEnabled' in liveEntry ? liveEntry.isEnabled : baseEntry?.isEnabled
      const newUses = 'uses' in liveEntry ? liveEntry.uses : baseEntry?.uses
      if (newIsEnabled !== oldIsEnabled || newUses !== oldUses) {
        if (newIsEnabled === false) {
          abilitiesParams.removeAbilityInvokes(side, targetKey)
        } else {
          abilitiesParams.addAbilityInvokes(side, targetKey, state)
        }
      }

      abilitiesParams.invokeOnParamSet(
        side,
        targetKey,
        Object.keys(updates),
        state,
      )
    }

    // Re-split participating/non-participating only when the update
    // touches a participation-affecting field. Keeps the hot path cheap
    // while catching Alastor / Eidolon / custom priority edits.
    if (
      abilitiesParams &&
      affectsParticipating(targetKey, Object.keys(updates))
    ) {
      abilitiesParams.combatState.resyncParticipating(side)
    }

    // SETTINGS drives `isCategoryMember`, which feeds the resolved-
    // restrictions cache. Drop the side's cache so the next check
    // rebuilds with fresh category membership.
    if (targetKey === 'SETTINGS') {
      sideData._resolvedRestrictions = undefined
    }
  }

  modifyHitValue(amount: number, target?: unknown): void {
    CombatSideState.addHitValueModifier(
      this._ctx._abilitiesParams.combatState.pendingSteps,
      this._side,
      amount,
      target,
      this._ctx.meta,
    )
  }

  /** True if this side's dice pool has no dice. Only meaningful during
   *  BEFORE_DICE_ROLL / BEFORE_UNIT_ABILITY_ROLL; returns true otherwise. */
  isDicePoolEmpty(): boolean {
    const pool = this._ctx.getDicePool(this._side)
    if (!pool) return true
    for (const dice of Object.values(pool)) {
      if (dice && dice.length > 0) return false
    }
    return true
  }

  /** Add `count` to an existing dice group's bonus. Without a target, or with
   *  `'BEST'` / `'WORST'`, modifies the die with the best / worst hit value.
   *  With a `UnitId`, modifies that unit's die. Only valid during
   *  BEFORE_DICE_ROLL / BEFORE_UNIT_ABILITY_ROLL. */
  addDiceCount(count: number, target?: 'BEST' | 'WORST' | UnitId): void {
    const pool = this._ctx.getDicePool(this._side)
    if (!pool) return
    // UnitId is a single-char packed token; 'BEST'/'WORST' are multi-char.
    if (typeof target === 'string' && target !== 'BEST' && target !== 'WORST') {
      for (const dice of Object.values(pool)) {
        if (!dice) continue
        for (let i = 0; i < dice.length; i++) {
          if (dice[i][3] === target) {
            dice[i] = [dice[i][0], dice[i][1], dice[i][2] + count, dice[i][3]]
            return
          }
        }
      }
      return
    }

    const isBest = target === undefined || target === 'BEST'
    let bestType: UnitBaseType | undefined
    let bestIndex = -1
    let bestHitValue = isBest ? Infinity : -Infinity

    for (const [type, dice] of Object.entries(pool)) {
      if (!dice) continue
      for (let i = 0; i < dice.length; i++) {
        const hitValue = dice[i][0]
        const better = isBest
          ? hitValue < bestHitValue
          : hitValue > bestHitValue
        if (better) {
          bestHitValue = hitValue
          bestType = type as UnitBaseType
          bestIndex = i
        }
      }
    }

    if (bestType !== undefined && bestIndex >= 0) {
      const dice = pool[bestType]!
      dice[bestIndex] = [
        dice[bestIndex][0],
        dice[bestIndex][1],
        dice[bestIndex][2] + count,
        dice[bestIndex][3],
      ]
    }
  }

  /** Overwrite the dice count for the group belonging to `unit`. Only valid
   *  during BEFORE_DICE_ROLL / BEFORE_UNIT_ABILITY_ROLL. */
  setDiceCount(count: number, unit: UnitId): void {
    const pool = this._ctx.getDicePool(this._side)
    if (!pool) return
    for (const dice of Object.values(pool)) {
      if (!dice) continue
      for (let i = 0; i < dice.length; i++) {
        if (dice[i][3] === unit) {
          dice[i] = [dice[i][0], count, dice[i][2], dice[i][3]]
          return
        }
      }
    }
  }

  /** Append a new dice group under `source`. Only valid during
   *  BEFORE_DICE_ROLL / BEFORE_UNIT_ABILITY_ROLL. */
  addDiceGroup(source: string, unit: UnitId, diceGroup: DiceGroup): void {
    const pool = this._ctx.getDicePool(this._side)
    if (!pool) return
    const existing = pool[source] ?? []
    pool[source] = [
      ...existing,
      [diceGroup[0], diceGroup[1], diceGroup[2] ?? 0, unit],
    ]
  }
}

// ============================================================================
// ABILITY CONTEXT
// ============================================================================

export class AbilityContext {
  logger?: Logger
  unitSource?: UnitId
  ownerFaction?: FactionKey
  ability?: Ability

  _abilitiesParams: AbilitiesEngine
  private _side: CombatSide
  private _api: { own: SideApi; opponent: SideApi }

  constructor(side: CombatSide, abilitiesParams: AbilitiesEngine) {
    this._side = side
    this._abilitiesParams = abilitiesParams
    this._api = {
      own: new SideApi(side, this),
      opponent: new SideApi(getOpponentSide(side), this),
    }
  }

  get state(): CombatStateData {
    return this._abilitiesParams.combatState.data
  }

  /** Innermost active meta-phase for the currently-running ability. Read
   *  straight off the dispatching `PhaseStep` via `combatState.currentStep`.
   *  Used by ability code and SideApi to scope phase-dependent effects (hit-
   *  value modifiers, context filters). Throws when called outside an active
   *  call context (e.g. PREPARE, which has no meta). */
  get meta(): MetaPhase {
    const phase = this.phaseStack
    if (phase && phase.length > 0) return phase[phase.length - 1]
    throw new Error(
      'ctx.meta is not available outside a PhaseStep-dispatched ability call',
    )
  }

  /** Active meta-phase stack (outer→inner) for the currently-running
   *  ability. Exposed for `trigger` / `resolveStep` to propagate. */
  get phaseStack(): MetaPhase[] | undefined {
    return this._abilitiesParams.combatState.currentStep?.phase
  }

  get side(): CombatSide {
    return this._side
  }

  get this(): Ability {
    if (!this.ability) {
      throw new Error('ctx.this is not set — no ability is currently running')
    }
    return this.ability
  }

  get api(): { own: SideApi; opponent: SideApi } {
    return this._api
  }

  get utils(): AbilityUtils {
    return abilityUtils
  }

  get abilities(): OwnOpponentContext<RuntimeAbilityList> {
    const opponent = getOpponentSide(this._side)
    return {
      own: this._abilitiesParams.runtimeAbilityList(this._side),
      opponent: this._abilitiesParams.runtimeAbilityList(opponent),
    }
  }

  getDicePool(side: CombatSide): DicePool | undefined {
    const ctx = this._abilitiesParams.combatState.currentGroupData
    return isDiceRollContext(ctx) ? ctx.dicePool?.[side] : undefined
  }

  upgradeForCall(ability: Ability, logger?: Logger) {
    this.logger = logger
    this.ability = ability
    this._api.own._abilityKey = ability.key
    this._api.own._abilitiesParams = this._abilitiesParams
    this._api.opponent._abilityKey = ability.key
    this._api.opponent._abilitiesParams = this._abilitiesParams
  }

  resetAfterCall() {
    this.logger = undefined
    this.ability = undefined
    this._api.own._abilityKey = undefined
    this._api.own._abilitiesParams = undefined
    this._api.opponent._abilityKey = undefined
    this._api.opponent._abilitiesParams = undefined
  }

  /** Queue a timing to run as the next script step. The triggered step
   *  inherits this ability's active phase stack (so `context`-scoped
   *  invokes resolve correctly) and runs only after the current `call`
   *  returns: the engine detects the script growth, parks the outer
   *  pass on its dispatching step's `frame` slot, and lets `advance()`
   *  dispatch the pushed step.
   *
   *  Trigger steps pop LIFO, so an ability that needs multiple triggers in
   *  a specific order must push them in reverse of that order.
   *
   *  A provided `context` is stored directly on the step's `data` slot,
   *  where `runAbilities` picks it up. Context-less triggers leave
   *  `data` unset. */
  trigger<T extends AbilityTiming>(
    name: T,
    context?: TimingContextMap[T],
  ): void {
    const combatState = this._abilitiesParams.combatState
    combatState.pendingSteps.push({
      kind: 'timing',
      timing: name,
      phase: this.phaseStack ?? [],
      data: context,
    })
  }

  transitionTo(target: 'COMPLETE', outcome?: 'DRAW' | 'LOST'): void {
    if (target !== 'COMPLETE') {
      throw new Error(`Impossible transition to ${target}`)
    }

    let winner: CombatSide | 'draw' = 'draw' as const
    if (outcome === 'LOST') {
      winner = getOpponentSide(this._side)
    }
    // Drop the current meta's script. Trigger steps pushed after this call
    // survive (they land on the empty stack); to keep any triggers, callers
    // must invoke `transitionTo` before pushing them.
    this._abilitiesParams.combatState._triggerCompletion(
      this.phaseStack!,
      winner,
    )
  }

  runDestroyAbilities(destroyed: UnitId[]): void {
    // Push a PhaseStepGroup carrying the destroyed-units map as shared
    // context. The calling ability is inside a script-driven pass, so
    // `tryResolveOne` parks the outer pass on return (it observes the
    // new pending entry) and `advance()` dispatches the cascade before
    // the outer pass resumes.
    const combatState = this._abilitiesParams.combatState
    combatState.pendingSteps.push(
      buildDestroyGroup(destroyed, this.phaseStack ?? []),
    )
  }

  /** Invoked by `SideApi.addHits` when an ability produces hits out-of-band
   *  (no existing hit pool from the normal dice-roll flow). Delegates to
   *  `combatState.assignHits`, which may throw `AbilityBranchInterrupt` if
   *  the destroy cascade branches. */
  _assignHits(): void {
    this._abilitiesParams.combatState.assignHits(this.phaseStack ?? [])
  }

  getUnit(): UnitId {
    if (this.unitSource === undefined) {
      throw new Error('getUnit() can only be called from unit abilities')
    }
    return this.unitSource
  }

  isOwner(): boolean {
    return (
      this.ownerFaction !== undefined &&
      this.state[this._side].faction === this.ownerFaction
    )
  }

  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[] {
    return this._abilitiesParams.getAbilityKeysForTiming(this._side, timing)
  }

  /** See AbilityCallContext.rollDice for full docs.
   *  For multi-outcome rolls, throws AbilityBranchInterrupt — the ability
   *  engine's tryResolveOne catches it and handles per-branch post-processing. */
  rollDice(
    dice: DiceGroup[],
    callback: (branchCtx: AbilityContext, hits: number[]) => void,
  ): never {
    const outcomes = getDiceOutcomes(dice)

    // Fast path: single outcome (empty dice, zero counts, or hitValue=1 only)
    // — run callback in place on the outer ctx, no branching.
    if (outcomes.length === 1) {
      callback(this, outcomes[0].hits)
      return undefined as never
    }

    const combatState = this._abilitiesParams.combatState
    const baseData = combatState.data
    const baseInvokes = combatState._invokes
    const baseInvokesOwned = combatState._invokesOwned
    const baseAllInvokes = combatState._allInvokes
    const baseAllInvokesOwned = combatState._allInvokesOwned
    const baseLogger = this.logger
    // Snapshot outer pending stack so each iteration starts from the same
    // position — otherwise a callback that pushes script state (e.g. a
    // destroy-cascade group via `destroyUnits`) would leak into siblings.
    const basePendingSteps = combatState.pendingSteps
    // Captured when upgradeForCall wired the ctx: the calling ability.
    const ability = this.ability

    const branches: AbilityBranch[] = []

    for (const outcome of outcomes) {
      // COW-arm invokes (same pattern as rollDiceOutcomes in CombatState)
      combatState._invokes = baseInvokes
      combatState._invokesOwned = false
      combatState._allInvokes = baseAllInvokes
      combatState._allInvokesOwned = false

      // Fresh per-iteration pending stack. Deep-copies groups so inner
      // steps-arrays aren't shared with the outer stack or other iterations.
      combatState.pendingSteps = clonePendingSteps(basePendingSteps)

      // Clone state for this branch. Phase is derived from the dispatching
      // step on `combatState`, which is shared — branches see the same meta.
      const branchData = cloneStateForBranch(baseData)
      combatState.data = branchData

      // Fork the logger so log entries from branches don't cross-contaminate.
      const branchLogger = baseLogger?.fork()
      branchLogger?.log({ diceHits: outcome.hits })

      // Build a fresh AbilityContext bound to this branch. Inherits the outer
      // ability's identity so updateAbilityConfig / getUnit() still behave
      // as if running under the outer ability.
      const branchCtx = new AbilityContext(this._side, this._abilitiesParams)
      branchCtx.unitSource = this.unitSource
      branchCtx.ownerFaction = this.ownerFaction
      if (ability) branchCtx.upgradeForCall(ability, branchLogger)

      try {
        callback(branchCtx, outcome.hits)
        branches.push({
          data: combatState.data,
          invokes: combatState._invokes,
          allInvokes: combatState._allInvokes,
          probability: outcome.probability,
          logger: branchLogger,
          pendingSteps: combatState.pendingSteps,
        })
      } catch (e) {
        if (!(e instanceof AbilityBranchInterrupt)) throw e
        // Callback branched further (e.g. addHits → assignHits → destroy
        // cascade rolled dice). Flatten nested branches into this loop.
        for (const nested of e.branches) {
          branches.push({
            data: nested.data,
            invokes: nested.invokes,
            allInvokes: nested.allInvokes,
            probability: outcome.probability * nested.probability,
            logger: nested.logger,
            pendingSteps: nested.pendingSteps ?? combatState.pendingSteps,
          })
        }
      } finally {
        branchCtx.resetAfterCall()
      }
    }

    // Restore outer state. tryResolveOne will take over handling via the
    // thrown interrupt — it clones/swaps branches for post-processing.
    combatState._invokes = baseInvokes
    combatState._invokesOwned = baseInvokesOwned
    combatState._allInvokes = baseAllInvokes
    combatState._allInvokesOwned = baseAllInvokesOwned
    combatState.data = baseData
    combatState.pendingSteps = basePendingSteps
    this.logger = baseLogger

    throw new AbilityBranchInterrupt(branches)
  }

  /** See AbilityCallContext.resolveStep for full docs. */
  resolveStep<M extends UnitAbilityMeta>(
    meta: M,
    overrides?: {
      dice?: DiceGroup[]
      target?: 'OWN' | 'OPPONENT'
    },
  ): void {
    if (!this.phaseStack) {
      throw new Error(
        'ctx.resolveStep requires an active phase stack (ability must be dispatched from a PhaseStep)',
      )
    }

    const mySide = this._side

    const customDice: SidedDiceData | undefined = overrides?.dice
      ? {
          attacker:
            mySide === 'attacker' ? diceGroupsToPool(overrides.dice) : {},
          defender:
            mySide === 'defender' ? diceGroupsToPool(overrides.dice) : {},
        }
      : undefined

    // target='OWN' flips firing side's hits to itself (self-damage).
    // Routing for the non-firing side is unused (it produces no hits).
    const routing: { attacker: CombatSide; defender: CombatSide } | undefined =
      overrides?.target === 'OWN'
        ? { attacker: mySide, defender: mySide }
        : undefined

    this._abilitiesParams.combatState.runUnitAbilityStepForAbility({
      meta,
      firing: [mySide],
      outerPhase: this.phaseStack,
      customDice,
      routing,
    })
  }
}

const SENTINEL_UNIT_ID = '' as UnitId

function diceGroupsToPool(groups: DiceGroup[] | undefined): DicePool {
  if (!groups || groups.length === 0) return {}
  const entries: SourcedDiceGroup[] = []
  for (const group of groups) {
    const [hitValue, count] = group
    const bonus = group.length === 3 ? group[2] : 0
    if (count + bonus <= 0) continue
    entries.push([hitValue, count, bonus, SENTINEL_UNIT_ID])
  }
  if (entries.length === 0) return {}
  return { __custom: entries }
}
