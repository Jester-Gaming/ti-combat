import type { UnitCategory } from '@/constants/units'
import { enforceFleetPool } from '@/data/abilities/general/fleet-pool'
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

import type { CombatSideState } from '../../combat-side-state/combat-side-state'
import { getOpponentSide } from '../../combat-side-state/combat-side-state'
import { cloneStateForBranch } from '../../combat-state/combat-state'
import type {
  CombatMode,
  CombatStateData,
  HitPool,
  HitSource,
  MetaPhase,
  UnitAbilityMeta,
} from '../../combat-state/types'
import { getDiceOutcomes } from '../../combat-state/utils'
import type { Logger } from '../../logger'
import type { AbilitiesEngine, InvokeCollections } from '../abilities-engine'
import type {
  Ability,
  AbilityBaseParams,
  AbilityTiming,
  DicePool,
  OwnOpponentContext,
  SidedDiceData,
} from '../types'

// ============================================================================
// BRANCH TYPES
// ============================================================================

export interface AbilityBranch {
  data: CombatStateData
  invokes: InvokeCollections
  probability: number
  logger?: Logger
}

/** Control-flow mechanism (not an Error — no stack trace overhead). */
export class AbilityBranchInterrupt {
  branches: AbilityBranch[]
  constructor(branches: AbilityBranch[]) {
    this.branches = branches
  }
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

  private get _sideState(): CombatSideState {
    return this._ctx.sideState(this._side)
  }

  private get state(): CombatStateData {
    return this._ctx.state
  }

  getFaction() {
    return this.state[this._side].faction
  }

  getUnits(unitType: UnitType, options?: { includeVariants: true }) {
    return this._sideState.getUnits(unitType, options?.includeVariants)
  }

  hasUnit(unitId: UnitId) {
    return this._sideState.hasUnit(unitId)
  }

  hasUnitType(unitType: UnitType, options?: { includeVariants: true }) {
    return this._sideState.hasUnitType(unitType, options?.includeVariants)
  }

  countUnits(
    filter?: UnitType | UnitType[],
    options?: { includeVariants: true },
  ) {
    return this._sideState.countUnits(filter, options?.includeVariants)
  }

  getPendingHits(filter?: { base?: true; bonus?: true }) {
    return this._sideState.getPendingHits(filter)
  }

  getHitPoolValidTargets() {
    return this._sideState.getHitPoolValidTargets()
  }

  getActiveBaseTypes() {
    return this._sideState.getActiveBaseTypes()
  }

  getParticipatingUnitTypes(options?: { combatMode?: CombatMode }) {
    return this._sideState.getParticipatingUnitTypes(options?.combatMode)
  }

  getUnitVariantsOptions(filter?: {
    include?: UnitType[]
    exclude?: UnitType[]
    excludeSubtypes?: UnitVariantId[]
    excludeSubtypeSource?: string[]
    includeSubtypes?: UnitVariantId[]
    combatMode?: CombatMode
    includeNonParticipating?: boolean
  }) {
    return this._sideState.getUnitVariantOptions(filter)
  }

  findUnitByPriority(priority: UnitType[]): UnitId | undefined
  findUnitByPriority(priority: UnitType[], amount: number): UnitId[]
  findUnitByPriority(
    priority: UnitType[],
    amount?: number,
  ): UnitId | UnitId[] | undefined {
    const participating = new Set(this._sideState.getParticipatingUnitTypes())
    if (amount !== undefined) {
      return this._sideState.findUnitByPriority(priority, participating, amount)
    }
    return this._sideState.findUnitByPriority(priority, participating)
  }

  /** Simulate resolving a HitPool against this side's current units —
   *  returns the UnitIds that would be destroyed, in sacrifice order.
   *  Non-destructive. */
  getAssignHitsTargets(hitPool: HitPool): UnitId[] {
    return this._sideState.getAssignHitsTargets(hitPool)
  }

  getUnitStats(unitTypeOrId: string | UnitId) {
    return this._sideState.getUnitStats(unitTypeOrId)
  }

  getVariantKey(unitId: UnitId) {
    return this._sideState.findVariantKey(unitId) || undefined
  }

  getUnitState(unitId: UnitId) {
    return this._sideState.getUnitState(unitId)
  }

  getUnitBaseType(unitId: UnitId) {
    return this._sideState.getUnitBaseType(unitId)
  }

  getUnitVariant(unitId: UnitId) {
    return this._sideState.getUnitVariant(unitId)
  }

  isUnitAbilityLost(ability: UnitAbility, unitType: string) {
    return this._sideState.isRestricted('lost', ability, unitType)
  }

  isUnitAbilityCannotBeUsed(ability: UnitAbility, unitType: string) {
    return this._sideState.isRestricted('cannotBeUsed', ability, unitType)
  }

  getAbilityConfig<K extends keyof AbilityConfigMap>(
    key: K,
  ): AbilityBaseParams & AbilityConfigMap[K]
  getAbilityConfig(key: string) {
    return this.state.abilities[this._side][key]
  }

  /** Destroy one or more units and fire DESTROY/WHEN_DESTROY/AFTER_DESTROY
   *  exactly once for the combined set (simultaneous destruction). */
  destroyUnits(target: UnitBaseType | UnitId | UnitId[]): void {
    const destroyed: Record<string, UnitId[]> = {}

    const stage = (unitId: UnitId, key: UnitType) => {
      const bucket = destroyed[key]
      if (bucket) bucket.push(unitId)
      else destroyed[key] = [unitId]
    }

    if (Array.isArray(target)) {
      for (const id of target) {
        const key = this._sideState.findVariantKey(id)
        if (!key) continue
        stage(id, key)
      }
    } else if (typeof target === 'string') {
      const found = this._sideState.findFirstUnitId(target)
      if (!found) return
      stage(found.unitId, found.key)
    } else {
      const key = this._sideState.findVariantKey(target)
      if (!key) return
      stage(target, key)
    }

    // Remove everything staged, then fire destroy abilities once.
    const keys = Object.keys(destroyed)
    if (keys.length === 0) return
    const flat: UnitId[] = []
    for (const k of keys) for (const id of destroyed[k]) flat.push(id)
    this._sideState.removeUnits(flat)

    if (this._abilitiesParams) {
      const context = {
        attacker: {} as Record<string, UnitId[]>,
        defender: {} as Record<string, UnitId[]>,
      }
      context[this._side] = destroyed
      this._ctx.runDestroyAbilities(context)
    }
  }

  removeUnits(target: UnitBaseType | UnitId | UnitId[]): void {
    this._sideState.removeUnits(target)
  }

  placeUnits(
    unitsToAdd: Partial<Record<UnitBaseType, number>>,
  ): Record<UnitBaseType, UnitId[]> {
    const placed = this._sideState.placeUnits(unitsToAdd)

    const abilitiesParams = this._abilitiesParams
    if (abilitiesParams) {
      for (const [unitType, newIds] of Object.entries(placed)) {
        abilitiesParams.queueUnitInvokes(
          this._side,
          unitType as UnitType,
          newIds,
        )
      }
    }
    enforceFleetPool(this)
    return placed as Record<UnitBaseType, UnitId[]>
  }

  modifyUnitType(key: UnitType, updates: Partial<UnitStats>): void {
    const { keysWithAbilitiesChange } = this._sideState.modifyUnitType(
      key,
      updates,
    )

    const abilitiesParams = this._abilitiesParams
    if (abilitiesParams) {
      for (const { key: vKey, ids } of keysWithAbilitiesChange) {
        abilitiesParams.queueUnitInvokes(this._side, vKey, ids)
      }
    }
  }

  modifyUnitState(unitId: UnitId, updates: Partial<UnitState>): void {
    this._sideState.modifyUnitState(unitId, updates)
  }

  reduceHits(amount: number) {
    this._sideState.reduceHits(amount)
  }

  addHits(hits: number, validTargets: UnitType[]) {
    this._sideState.addHits(hits, validTargets)
  }

  setUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ) {
    this._sideState.addRestriction('lost', ability, reason, target)
  }

  removeUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ) {
    this._sideState.removeRestriction('lost', ability, reason, target)
  }

  setUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ) {
    this._sideState.addRestriction('cannotBeUsed', ability, reason, target)
  }

  removeUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ) {
    this._sideState.removeRestriction('cannotBeUsed', ability, reason, target)
  }

  addSubtype(
    variantId: UnitType,
    subtype: UnitVariantId,
    statsFactory?: (parentStats: UnitStats) => UnitStats,
  ) {
    this._sideState.addSubtype(variantId, subtype, statsFactory)
  }

  removeSubtype(variantId: UnitType, subtype: UnitVariantId) {
    this._sideState.removeSubtype(variantId, subtype)
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

    // COW: shallow-copy the abilities path so mutations don't leak
    // into other branches sharing the same abilities object.
    state.abilities = { ...state.abilities }
    state.abilities[side] = { ...state.abilities[side] }
    const sideConfig = state.abilities[side]

    if (!sideConfig[targetKey]) {
      sideConfig[targetKey] = {}
    } else {
      sideConfig[targetKey] = { ...sideConfig[targetKey] }
    }

    const oldIsEnabled = sideConfig[targetKey].isEnabled
    const oldUses = sideConfig[targetKey].uses

    for (const [key, value] of Object.entries(updates)) {
      sideConfig[targetKey][key] =
        typeof value === 'function' ? value(sideConfig[targetKey][key]) : value
    }

    const abilitiesParams = this._abilitiesParams
    if (abilitiesParams) {
      if (
        sideConfig[targetKey].isEnabled !== oldIsEnabled ||
        sideConfig[targetKey].uses !== oldUses
      ) {
        abilitiesParams.syncInvokesForKey(side, targetKey, state)
      }

      abilitiesParams.invokeOnParamSet(
        side,
        targetKey,
        Object.keys(updates),
        state,
      )
    }
  }

  modifyHitValue(amount: number, target?: unknown): void {
    this._sideState.addHitValueModifier(
      amount,
      target,
      this.state.currentPhase.meta,
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
    if (typeof target === 'number') {
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

  private _abilitiesParams: AbilitiesEngine
  private _side: CombatSide
  private _draftState?: CombatStateData
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
    return this._draftState ?? this._abilitiesParams.combatState.data
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

  sideState(side: CombatSide): CombatSideState {
    return this._abilitiesParams.combatState.side(side)
  }

  get api(): { own: SideApi; opponent: SideApi } {
    return this._api
  }

  get abilities(): OwnOpponentContext<readonly Ability[]> {
    const opponent = getOpponentSide(this._side)
    return {
      own: this._abilitiesParams.getAbilities(this._side),
      opponent: this._abilitiesParams.getAbilities(opponent),
    }
  }

  getDicePool(side: CombatSide): DicePool | undefined {
    return this._abilitiesParams._currentDicePool?.[side]
  }

  upgradeForCall(draft: CombatStateData, ability: Ability, logger?: Logger) {
    this._draftState = draft
    this.logger = logger
    this.ability = ability
    this._api.own._abilityKey = ability.key
    this._api.own._abilitiesParams = this._abilitiesParams
    this._api.opponent._abilityKey = ability.key
    this._api.opponent._abilitiesParams = this._abilitiesParams
  }

  resetAfterCall() {
    this._draftState = undefined
    this.logger = undefined
    this.ability = undefined
    this._api.own._abilityKey = undefined
    this._api.own._abilitiesParams = undefined
    this._api.opponent._abilityKey = undefined
    this._api.opponent._abilitiesParams = undefined
  }

  /** Run nested abilities preserving current call context */
  private nested(fn: () => void): void {
    const saved = {
      unitSource: this.unitSource,
      ownerFaction: this.ownerFaction,
      logger: this.logger,
      ability: this.ability,
      ownAbilityKey: this._api.own._abilityKey,
      ownAbilityEngine: this._api.own._abilitiesParams,
      opponentAbilityKey: this._api.opponent._abilityKey,
      opponentAbilityEngine: this._api.opponent._abilitiesParams,
    }
    fn()
    this.unitSource = saved.unitSource
    this.ownerFaction = saved.ownerFaction
    this.logger = saved.logger
    this.ability = saved.ability
    this._api.own._abilityKey = saved.ownAbilityKey
    this._api.own._abilitiesParams = saved.ownAbilityEngine
    this._api.opponent._abilityKey = saved.opponentAbilityKey
    this._api.opponent._abilitiesParams = saved.opponentAbilityEngine
  }

  trigger<T extends AbilityTiming>(
    name: T | T[],
    context?: TimingContextMap[T],
  ): void {
    this.nested(() => {
      this._abilitiesParams.runAbilities(name, context, {}, this.logger)
    })
  }

  transitionTo(target: MetaPhase, outcome?: 'DRAW' | 'LOST'): void {
    if (this.state.transitionTarget) return
    this.state.transitionTarget = target
    if (outcome === 'DRAW') {
      this.state.winnerOverride = 'draw'
    } else if (outcome === 'LOST') {
      this.state.winnerOverride = getOpponentSide(this._side)
    }
  }

  runDestroyAbilities(destroyed: {
    attacker: Record<string, UnitId[]>
    defender: Record<string, UnitId[]>
  }): void {
    this.nested(() => {
      this._abilitiesParams.runDestroyAbilities(destroyed)
    })
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
    const baseLogger = this.logger
    // Captured when upgradeForCall wired the ctx: the calling ability.
    const ability = this.ability

    const branches: AbilityBranch[] = []

    for (const outcome of outcomes) {
      // COW-arm invokes (same pattern as rollDiceOutcomes in CombatState)
      combatState._invokes = baseInvokes
      combatState._invokesOwned = false

      // Clone state for this branch. Keep same phase — we're branching
      // within the current phase, not transitioning.
      const branchData = cloneStateForBranch(baseData, baseData.currentPhase)
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
      if (ability) branchCtx.upgradeForCall(branchData, ability, branchLogger)

      callback(branchCtx, outcome.hits)

      branchCtx.resetAfterCall()

      branches.push({
        data: combatState.data,
        invokes: combatState._invokes,
        probability: outcome.probability,
        logger: branchLogger,
      })
    }

    // Restore outer state. tryResolveOne will take over handling via the
    // thrown interrupt — it clones/swaps branches for post-processing.
    combatState._invokes = baseInvokes
    combatState._invokesOwned = baseInvokesOwned
    combatState.data = baseData
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
    callback?: (branchCtx: AbilityContext) => void,
  ): void {
    const combatState = this._abilitiesParams.combatState
    const ability = this.ability

    const mySide = this._side
    const firing: CombatSide[] = [mySide]
    const hitSource = META_TO_HIT_SOURCE[meta]

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

    const baseInvokes = combatState._invokes
    const baseInvokesOwned = combatState._invokesOwned
    const baseData = combatState.data
    const baseLogger = this.logger
    const baseCombatLogger = combatState._logger

    if (this.logger) combatState._logger = this.logger

    const stepBranches = combatState.runUnitAbilityStepForAbility({
      meta,
      firing,
      hitSource,
      customDice,
      routing,
    })

    if (stepBranches.length === 1 && stepBranches[0].probability === 1) {
      combatState.data = stepBranches[0].state.data
      combatState._invokes = stepBranches[0].state._invokes
      combatState._invokesOwned = false
      combatState._logger = stepBranches[0].state._logger
      this.logger = stepBranches[0].state._logger
      if (callback) callback(this)
      return
    }

    combatState._logger = baseCombatLogger

    const branches: AbilityBranch[] = []

    try {
      for (const { state: branchState, probability } of stepBranches) {
        combatState._invokes = branchState._invokes
        combatState._invokesOwned = false
        combatState.data = branchState.data
        const branchLogger = branchState._logger

        if (!callback) {
          branches.push({
            data: branchState.data,
            invokes: branchState._invokes,
            probability,
            logger: branchLogger,
          })
          continue
        }

        const branchCtx = new AbilityContext(this._side, this._abilitiesParams)
        branchCtx.unitSource = this.unitSource
        branchCtx.ownerFaction = this.ownerFaction
        if (ability)
          branchCtx.upgradeForCall(branchState.data, ability, branchLogger)

        try {
          callback(branchCtx)
          branches.push({
            data: combatState.data,
            invokes: combatState._invokes,
            probability,
            logger: branchLogger,
          })
        } catch (e) {
          if (!(e instanceof AbilityBranchInterrupt)) throw e
          for (const nested of e.branches) {
            branches.push({
              data: nested.data,
              invokes: nested.invokes,
              probability: probability * nested.probability,
              logger: nested.logger,
            })
          }
        } finally {
          branchCtx.resetAfterCall()
        }
      }
    } finally {
      combatState._invokes = baseInvokes
      combatState._invokesOwned = baseInvokesOwned
      combatState.data = baseData
      this.logger = baseLogger
    }

    throw new AbilityBranchInterrupt(branches)
  }
}

const META_TO_HIT_SOURCE: Record<UnitAbilityMeta, HitSource> = {
  BOMBARDMENT: 'BOMBARDMENT',
  AFB: 'AFB',
  SPACE_CANNON_OFFENSE: 'SPACE_CANNON',
  SPACE_CANNON_DEFENSE: 'SPACE_CANNON',
}

const SENTINEL_UNIT_ID = -1 as UnitId

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
