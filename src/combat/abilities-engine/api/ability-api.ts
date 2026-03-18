import type {
  CombatSide,
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
import type { CombatMode, CombatStateData } from '../../combat-state/types'
import type { Logger } from '../../logger'
import type { AbilitiesEngine } from '../abilities-engine'
import type { AbilityTiming, SettingsParams, TimingContextMap } from '../types'

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

  getPendingHits() {
    return this._sideState.getPendingHits()
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
    include?: UnitBaseType[]
    exclude?: UnitBaseType[]
    excludeSubtypes?: UnitVariantId[]
    combatMode?: CombatMode
    includeNonParticipating?: boolean
  }) {
    return this._sideState.getUnitVariantOptions(filter)
  }

  findUnitByPriority(priority: UnitType[]) {
    const participating = new Set(this._sideState.getParticipatingUnitTypes())
    return this._sideState.findUnitByPriority(priority, participating)
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

  getAbilityConfig(key: 'SETTINGS'): SettingsParams
  getAbilityConfig(key: string): Record<string, unknown>
  getAbilityConfig(key: string) {
    return this.state.abilities[this._side][key]
  }

  destroyUnit(unitTypeOrUnit: UnitBaseType | UnitId): void {
    let unitId: UnitId
    let key: UnitType

    if (typeof unitTypeOrUnit === 'string') {
      const found = this._sideState.findFirstUnitId(unitTypeOrUnit)
      if (!found) return
      unitId = found.unitId
      key = found.key
    } else {
      unitId = unitTypeOrUnit
      const found = this._sideState.findVariantKey(unitId)
      if (!found) return
      key = found
    }

    this._sideState.removeUnit(unitId)

    if (this._abilitiesParams) {
      const destroyed = {
        attacker: {} as Record<string, UnitId[]>,
        defender: {} as Record<string, UnitId[]>,
      }
      destroyed[this._side][key] = [unitId]
      this._ctx.runDestroyAbilities(destroyed)
    }
  }

  removeUnit(unitTypeOrUnit: UnitBaseType | UnitId): void {
    this._sideState.removeUnit(unitTypeOrUnit)
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
    unitType?: UnitBaseType,
  ) {
    this._sideState.addRestriction('lost', ability, reason, unitType)
  }

  removeUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitBaseType,
  ) {
    this._sideState.removeRestriction('lost', ability, reason, unitType)
  }

  setUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitBaseType,
  ) {
    this._sideState.addRestriction('cannotBeUsed', ability, reason, unitType)
  }

  removeUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitBaseType,
  ) {
    this._sideState.removeRestriction('cannotBeUsed', ability, reason, unitType)
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
}

// ============================================================================
// ABILITY CONTEXT
// ============================================================================

export class AbilityContext {
  logger?: Logger
  unitSource?: UnitId

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

  sideState(side: CombatSide): CombatSideState {
    return this._abilitiesParams.combatState.side(side)
  }

  get api(): { own: SideApi; opponent: SideApi } {
    return this._api
  }

  upgradeForCall(draft: CombatStateData, abilityKey: string, logger?: Logger) {
    this._draftState = draft
    this.logger = logger
    this._api.own._abilityKey = abilityKey
    this._api.own._abilitiesParams = this._abilitiesParams
    this._api.opponent._abilityKey = abilityKey
    this._api.opponent._abilitiesParams = this._abilitiesParams
  }

  resetAfterCall() {
    this._draftState = undefined
    this.logger = undefined
    this._api.own._abilityKey = undefined
    this._api.own._abilitiesParams = undefined
    this._api.opponent._abilityKey = undefined
    this._api.opponent._abilitiesParams = undefined
  }

  /** Run nested abilities preserving current call context */
  private nested(fn: () => void): void {
    const saved = {
      unitSource: this.unitSource,
      logger: this.logger,
      ownAbilityKey: this._api.own._abilityKey,
      ownAbilityEngine: this._api.own._abilitiesParams,
      opponentAbilityKey: this._api.opponent._abilityKey,
      opponentAbilityEngine: this._api.opponent._abilitiesParams,
    }
    fn()
    this.unitSource = saved.unitSource
    this.logger = saved.logger
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
      this._abilitiesParams.runAbilities(
        name,
        context,
        { triggerSide: this._side },
        this.logger,
      )
    })
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
    if (!this.unitSource) {
      throw new Error('getUnit() can only be called from unit abilities')
    }
    return this.unitSource
  }

  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[] {
    return this._abilitiesParams.getAbilityKeysForTiming(this._side, timing)
  }
}
