import { getSettingsValidTargets } from '@/combat/combat-side-state/utils/get-settings-valid-targets'
import { UNIT_LIMITS } from '@/constants/units'
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

import { getOpponentSide } from '../../combat-side-state/combat-side-state'
import type {
  CombatMode,
  CombatStateData,
  RestrictionEntry,
  SideStateData,
  UnitAbilityRestrictions,
} from '../../combat-state/types'
import type { Logger } from '../../logger'
import { resolveUnitStats, totalCountForType } from '../../utils/compact-units'
import { nextUnitIds } from '../../utils/unit-id'
import {
  getVariantDisplayName,
  makeVariantId,
  parseVariantId,
} from '../../utils/unit-variant'
import type { AbilitiesParams } from '../abilities-params'
import type {
  AbilityTiming,
  DeclaredSubtype,
  SettingsParams,
  TimingContextMap,
} from '../types'

// ============================================================================
// HELPERS
// ============================================================================

function findUnitIdByPriorityInSide(
  sideState: SideStateData,
  priority: UnitType[],
  participatingTypes?: ReadonlySet<UnitBaseType>,
): UnitId | undefined {
  for (const variantId of priority) {
    const { type } = parseVariantId(variantId)
    if (participatingTypes && !participatingTypes.has(type)) continue
    const ids = sideState.units[variantId]
    if (!ids || ids.length <= 0) continue
    return ids[0]
  }
  return undefined
}

function countUnitsInSide(
  sideState: SideStateData,
  filter?: UnitType | UnitType[],
  includeVariants?: boolean,
): number {
  if (!filter) {
    let total = 0
    for (const key of Object.keys(sideState.units)) {
      total += sideState.units[key as UnitType].length
    }
    return total
  }

  const filters = typeof filter === 'string' ? [filter] : filter

  if (includeVariants) {
    const baseTypes = new Set(filters.map(f => parseVariantId(f).type))
    let total = 0
    for (const key of Object.keys(sideState.units) as UnitType[]) {
      const ids = sideState.units[key]
      if (ids.length <= 0) continue
      if (baseTypes.has(parseVariantId(key).type)) {
        total += ids.length
      }
    }
    return total
  }

  let total = 0
  for (const f of filters) {
    total += sideState.units[f]?.length ?? 0
  }
  return total
}

function getPendingHitsForSide(sideState: SideStateData): number {
  return sideState.hitPools.reduce((sum, pool) => sum + pool.hits, 0)
}

function isRestricted(
  sideState: SideStateData,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbility,
  unitType: string,
): boolean {
  const entries = sideState.unitAbilityRestrictions?.[layer]?.[ability]
  if (!entries) return false
  const { type: baseType } = parseVariantId(unitType)
  return entries.some(
    e => !e.unitType || e.unitType === unitType || e.unitType === baseType,
  )
}

function addRestrictionEntry(
  restrictions: UnitAbilityRestrictions | undefined,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbility,
  reason: string,
  unitType?: UnitBaseType,
): UnitAbilityRestrictions {
  const current = restrictions ?? {}
  const layerData = current[layer] ?? {}
  const entries = layerData[ability] ?? []
  const entry: RestrictionEntry = unitType ? { reason, unitType } : { reason }

  return {
    ...current,
    [layer]: {
      ...layerData,
      [ability]: [...entries, entry],
    },
  }
}

function removeRestrictionEntry(
  restrictions: UnitAbilityRestrictions | undefined,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbility,
  reason: string,
  unitType?: UnitBaseType,
): UnitAbilityRestrictions | undefined {
  if (!restrictions) return undefined
  const layerData = restrictions[layer]
  if (!layerData) return restrictions
  const entries = layerData[ability]
  if (!entries) return restrictions

  const filtered = entries.filter(
    e => e.reason !== reason || e.unitType !== unitType,
  )

  const newLayerData = { ...layerData }
  if (filtered.length > 0) {
    newLayerData[ability] = filtered
  } else {
    delete newLayerData[ability]
  }

  const hasEntries = Object.keys(newLayerData).length > 0
  const result = {
    ...restrictions,
    [layer]: hasEntries ? newLayerData : undefined,
  }

  if (!result.lost && !result.cannotBeUsed) return undefined
  return result
}

function getParticipatingUnitTypesForSide(
  state: Readonly<CombatStateData>,
  side: CombatSide,
  combatModeOverride?: CombatMode,
): UnitBaseType[] {
  const settings = state.abilities[side]['SETTINGS']
  const mode = combatModeOverride ?? state.combatMode
  if (!settings) {
    const sideState = state[side]
    const types = new Set<UnitBaseType>()
    for (const key of Object.keys(sideState.units) as UnitType[]) {
      if (sideState.units[key].length <= 0) continue
      const { type } = parseVariantId(key)
      types.add(type)
    }
    return [...types]
  }
  return mode === 'GROUND'
    ? ((settings.groundCombatParticipating as UnitBaseType[]) ?? [])
    : ((settings.spaceCombatParticipating as UnitBaseType[]) ?? [])
}

function getAllUnitTypesForSide(
  state: Readonly<CombatStateData>,
  side: CombatSide,
  combatModeOverride?: CombatMode,
): UnitBaseType[] {
  const settings = state.abilities[side]['SETTINGS']
  if (!settings) {
    const sideState = state[side]
    const types = new Set<UnitBaseType>()
    for (const key of Object.keys(sideState.units) as UnitType[]) {
      if (sideState.units[key].length <= 0) continue
      const { type } = parseVariantId(key)
      types.add(type)
    }
    return [...types]
  }
  const mode = combatModeOverride ?? state.combatMode
  const participating =
    mode === 'GROUND'
      ? ((settings.groundCombatParticipating as UnitBaseType[]) ?? [])
      : ((settings.spaceCombatParticipating as UnitBaseType[]) ?? [])
  const structures = (settings.structures as UnitBaseType[]) ?? []
  return [...new Set([...participating, ...structures])]
}

function getUnitVariantsForSide(
  state: Readonly<CombatStateData>,
  side: CombatSide,
  filter?: {
    include?: UnitBaseType[]
    exclude?: UnitBaseType[]
    excludeSubtypes?: string[]
    combatMode?: CombatMode
    includeNonParticipating?: boolean
  },
): UnitType[] {
  let baseTypes = filter?.includeNonParticipating
    ? getAllUnitTypesForSide(state, side, filter?.combatMode)
    : getParticipatingUnitTypesForSide(state, side, filter?.combatMode)
  if (filter?.include) {
    const includeSet = new Set(filter.include)
    baseTypes = baseTypes.filter(t => includeSet.has(t))
  }
  if (filter?.exclude) {
    const excludeSet = new Set(filter.exclude)
    baseTypes = baseTypes.filter(t => !excludeSet.has(t))
  }
  const settings = state.abilities[side]['SETTINGS']
  const declaredSubtypes = (settings?.subtypes ?? []) as DeclaredSubtype[]
  const excludeSubtypeSet = filter?.excludeSubtypes
    ? new Set(filter.excludeSubtypes)
    : null

  // Filter out variant IDs already in baseTypes whose subtypes are excluded
  // (spaceCombatParticipating etc. may contain variant IDs from expandWithSubtypes)
  if (excludeSubtypeSet) {
    baseTypes = baseTypes.filter(t => {
      const { subtypes } = parseVariantId(t)
      return (
        subtypes.length === 0 || !subtypes.some(s => excludeSubtypeSet.has(s))
      )
    })
  }

  const baseSet = new Set<string>(baseTypes)
  const result: UnitType[] = [...baseTypes]
  const addedSet = new Set<string>(baseTypes)
  for (const decl of declaredSubtypes) {
    if (excludeSubtypeSet?.has(decl.name)) continue
    const { type, subtypes: parentSubs } = parseVariantId(decl.unitType)
    if (!baseSet.has(decl.unitType) && !addedSet.has(decl.unitType)) continue
    if (excludeSubtypeSet && parentSubs.some(s => excludeSubtypeSet.has(s)))
      continue
    const variantId = makeVariantId(type, [
      ...parentSubs,
      decl.name as UnitVariantId,
    ])
    if (addedSet.has(variantId)) continue
    result.push(variantId)
    addedSet.add(variantId)
  }
  return result
}

function resolveSettingsValidTargets(
  state: Readonly<CombatStateData>,
  side: CombatSide,
): UnitBaseType[] {
  const settings = state.abilities[side]['SETTINGS']
  if (!settings) return []
  return getSettingsValidTargets(settings, state.currentPhase.meta)
}

// ============================================================================
// SIDE API
// ============================================================================

export class SideApi {
  private _side: CombatSide
  private _ctx!: AbilityContext
  _abilityKey?: string
  _abilitiesParams?: AbilitiesParams

  constructor(side: CombatSide, ctx: AbilityContext) {
    this._side = side
    this._ctx = ctx
  }

  private get state(): CombatStateData {
    return this._ctx.state
  }

  private get sideState(): SideStateData {
    return this.state[this._side]
  }

  getFaction() {
    return this.sideState.faction
  }

  getUnits(unitType: UnitType, options?: { includeVariants: true }) {
    const sideState = this.sideState
    if (options?.includeVariants) {
      const result: UnitId[] = []
      for (const key of Object.keys(sideState.units) as UnitType[]) {
        const { type } = parseVariantId(key)
        if (type === unitType) {
          result.push(...sideState.units[key])
        }
      }
      return result
    }
    return sideState.units[unitType] ?? []
  }

  hasUnit(unitId: UnitId) {
    return findVariantKeyContaining(this.sideState, unitId) !== ''
  }

  hasUnitType(unitType: UnitType, options?: { includeVariants: true }) {
    if (options?.includeVariants) {
      return (
        totalCountForType(this.sideState.units, parseVariantId(unitType).type) >
        0
      )
    }
    const ids = this.sideState.units[unitType]
    return !!ids && ids.length > 0
  }

  countUnits(
    filter?: UnitType | UnitType[],
    options?: { includeVariants: true },
  ) {
    return countUnitsInSide(this.sideState, filter, options?.includeVariants)
  }

  getPendingHits() {
    return getPendingHitsForSide(this.sideState)
  }

  getHitPoolValidTargets() {
    const pool = this.sideState.hitPools[0]
    if (pool && pool.validTargets.length > 0) return pool.validTargets
    return resolveSettingsValidTargets(this.state, this._side)
  }

  getActiveBaseTypes() {
    const sideState = this.sideState
    const types = new Set<UnitBaseType>()
    for (const key of Object.keys(sideState.units) as UnitType[]) {
      if (sideState.units[key].length <= 0) continue
      const { type } = parseVariantId(key)
      types.add(type)
    }
    return [...types]
  }

  getParticipatingUnitTypes(options?: { combatMode?: CombatMode }) {
    return getParticipatingUnitTypesForSide(
      this.state,
      this._side,
      options?.combatMode,
    )
  }

  getUnitVariantsOptions(filter?: {
    include?: UnitBaseType[]
    exclude?: UnitBaseType[]
    excludeSubtypes?: UnitVariantId[]
    combatMode?: CombatMode
    includeNonParticipating?: boolean
  }) {
    return getUnitVariantsForSide(this.state, this._side, filter).map(id => ({
      label: getVariantDisplayName(id),
      value: id,
    }))
  }

  findUnitByPriority(priority: UnitType[]) {
    const participating = new Set(
      getParticipatingUnitTypesForSide(this.state, this._side),
    )
    return findUnitIdByPriorityInSide(this.sideState, priority, participating)
  }

  getUnitStats(unitTypeOrId: string | UnitId) {
    const sideState = this.sideState
    if (typeof unitTypeOrId === 'string') {
      const stats = resolveUnitStats(sideState, unitTypeOrId as UnitType)
      if (stats) return stats
      const { type } = parseVariantId(unitTypeOrId)
      if (type !== unitTypeOrId) {
        return resolveUnitStats(sideState, type)
      }
      return undefined
    }
    const key = findVariantKeyContaining(sideState, unitTypeOrId)
    if (!key) return undefined
    return resolveUnitStats(sideState, key)
  }

  getVariantKey(unitId: UnitId) {
    return findVariantKeyContaining(this.sideState, unitId) || undefined
  }

  getUnitState(unitId: UnitId) {
    const sideState = this.sideState
    const key = findVariantKeyContaining(sideState, unitId)
    if (!key) return undefined
    return sideState.unitState[unitId] ?? {}
  }

  getUnitBaseType(unitId: UnitId) {
    const key = findVariantKeyContaining(this.sideState, unitId)
    if (!key) return undefined
    return parseVariantId(key).type as UnitBaseType
  }

  getUnitVariant(unitId: UnitId) {
    return findVariantKeyContaining(this.sideState, unitId) || undefined
  }

  isUnitAbilityLost(ability: UnitAbility, unitType: string) {
    return isRestricted(this.sideState, 'lost', ability, unitType)
  }

  isUnitAbilityCannotBeUsed(ability: UnitAbility, unitType: string) {
    return isRestricted(this.sideState, 'cannotBeUsed', ability, unitType)
  }

  getAbilityConfig(key: 'SETTINGS'): SettingsParams
  getAbilityConfig(key: string): Record<string, unknown>
  getAbilityConfig(key: string) {
    return this.state.abilities[this._side][key]
  }

  destroyUnit(unitTypeOrUnit: UnitBaseType | UnitId): void {
    const sideState = this.sideState
    let unitId: UnitId
    let key: UnitType

    if (typeof unitTypeOrUnit === 'string') {
      const found = findFirstUnitId(sideState, unitTypeOrUnit)
      if (!found) return
      unitId = found.unitId
      key = found.key
    } else {
      unitId = unitTypeOrUnit
      const found = findVariantKeyContaining(sideState, unitId)
      if (!found) return
      key = found
    }

    this.removeUnit(unitId)

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
    const sideState = this.sideState

    let unitId: UnitId
    let key: UnitType

    if (typeof unitTypeOrUnit === 'string') {
      const found = findFirstUnitId(sideState, unitTypeOrUnit)
      if (!found) return
      unitId = found.unitId
      key = found.key
    } else {
      unitId = unitTypeOrUnit
      const found = findVariantKeyContaining(sideState, unitId)
      if (!found) return
      key = found
    }

    const ids = sideState.units[key]
    const idx = ids.indexOf(unitId)
    if (idx === -1) return

    ids.splice(idx, 1)
    delete sideState.unitState[unitId]

    if (ids.length <= 0) {
      delete sideState.units[key]
    }
  }

  placeUnits(unitsToAdd: Partial<Record<UnitBaseType, number>>) {
    const sideState = this.sideState

    for (const [type, count] of Object.entries(unitsToAdd)) {
      const unitType = type as UnitBaseType
      if (!count || count <= 0) continue
      const existing = totalCountForType(sideState.units, unitType)
      const limit = UNIT_LIMITS[unitType]
      if (existing + count > limit) {
        console.warn(
          `Unit limit exceeded: ${unitType} has a maximum of ${limit}`,
        )
      }
      const allowed = Math.min(count, limit - existing)
      if (allowed <= 0) continue

      const newIds = nextUnitIds(allowed)
      if (!sideState.units[unitType]) {
        sideState.units[unitType] = []
      }
      sideState.units[unitType].push(...newIds)
      if (!sideState.unitStats[unitType]) {
        sideState.unitStats[unitType] = {}
      }

      const abilitiesParams = this._abilitiesParams
      if (abilitiesParams) {
        abilitiesParams.queueUnitInvokes(this._side, unitType, newIds)
      }
    }
  }

  modifyUnitType(key: UnitType, updates: Partial<UnitStats>): void {
    const sideState = this.sideState

    const { type } = parseVariantId(key)
    const isVariantKey = key.includes(':')
    const abilitiesParams = this._abilitiesParams

    if (isVariantKey) {
      if (sideState.unitStats[key]) {
        if (typeof sideState.unitStats[key] === 'function') {
          sideState.unitStats[key] = resolveUnitStats(sideState, key)!
        }
        Object.assign(sideState.unitStats[key], updates)
      }
      const ids = sideState.units[key]
      if ('ABILITIES' in updates && abilitiesParams && ids?.length > 0) {
        abilitiesParams.queueUnitInvokes(this._side, key, ids)
      }
    } else {
      const hasAbilitiesUpdate = 'ABILITIES' in updates
      for (const vKey of Object.keys(sideState.units) as UnitType[]) {
        const { type: vType } = parseVariantId(vKey)
        if (vType !== type) continue
        if (sideState.unitStats[vKey]) {
          if (typeof sideState.unitStats[vKey] === 'function') {
            sideState.unitStats[vKey] = resolveUnitStats(sideState, vKey)!
          }
          Object.assign(sideState.unitStats[vKey], updates)
        }
        const ids = sideState.units[vKey]
        if (hasAbilitiesUpdate && abilitiesParams && ids?.length > 0) {
          abilitiesParams.queueUnitInvokes(this._side, vKey, ids)
        }
      }
      if (sideState.unitStats[type]) {
        if (typeof sideState.unitStats[type] === 'function') {
          sideState.unitStats[type] = resolveUnitStats(sideState, type)!
        }
        Object.assign(sideState.unitStats[type], updates)
      }
    }
  }

  modifyUnitState(unitId: UnitId, updates: Partial<UnitState>): void {
    this.sideState.unitState[unitId] ??= {}
    Object.assign(this.sideState.unitState[unitId], updates)
  }

  reduceHits(amount: number) {
    const sideState = this.sideState
    if (sideState.hitPools.length === 0 || amount <= 0) return
    let remaining = amount
    for (const pool of sideState.hitPools) {
      const reduce = Math.min(remaining, pool.hits)
      pool.hits -= reduce
      remaining -= reduce
      if (remaining <= 0) break
    }
  }

  addHits(hits: number, validTargets: UnitType[]) {
    if (hits === 0) return
    this.sideState.hitPools.push({ hits, validTargets })
  }

  setUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitBaseType,
  ) {
    const sideState = this.sideState
    sideState.unitAbilityRestrictions = addRestrictionEntry(
      sideState.unitAbilityRestrictions,
      'lost',
      ability,
      reason,
      unitType,
    )
  }

  removeUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitBaseType,
  ) {
    const sideState = this.sideState
    sideState.unitAbilityRestrictions = removeRestrictionEntry(
      sideState.unitAbilityRestrictions,
      'lost',
      ability,
      reason,
      unitType,
    )
  }

  setUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitBaseType,
  ) {
    const sideState = this.sideState
    sideState.unitAbilityRestrictions = addRestrictionEntry(
      sideState.unitAbilityRestrictions,
      'cannotBeUsed',
      ability,
      reason,
      unitType,
    )
  }

  removeUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    unitType?: UnitBaseType,
  ) {
    const sideState = this.sideState
    sideState.unitAbilityRestrictions = removeRestrictionEntry(
      sideState.unitAbilityRestrictions,
      'cannotBeUsed',
      ability,
      reason,
      unitType,
    )
  }

  addSubtype(
    variantId: UnitType,
    subtype: UnitVariantId,
    statsFactory?: (parentStats: UnitStats) => UnitStats,
  ) {
    const sideState = this.sideState

    const { type, subtypes: currentSubtypes } = parseVariantId(variantId)

    let sourceKey: UnitType = variantId
    if (!sideState.units[sourceKey] || sideState.units[sourceKey].length <= 0) {
      sourceKey = type
    }
    if (!sideState.units[sourceKey] || sideState.units[sourceKey].length <= 0)
      return

    const newSubtypes = [...currentSubtypes, subtype].sort()
    const newKey = makeVariantId(type, newSubtypes as UnitVariantId[])
    if (newKey === sourceKey) return

    const movedId = sideState.units[sourceKey].pop()!
    if (sideState.units[sourceKey].length <= 0) {
      delete sideState.units[sourceKey]
    }

    if (!sideState.units[newKey]) {
      sideState.units[newKey] = []
    }
    sideState.units[newKey].push(movedId)

    if (!sideState.unitStats[newKey]) {
      if (statsFactory) {
        sideState.unitStats[newKey] = statsFactory
      } else {
        const sourceStats =
          resolveUnitStats(sideState, sourceKey) ??
          resolveUnitStats(sideState, type)
        if (sourceStats) {
          sideState.unitStats[newKey] = { ...sourceStats }
        }
      }
    }
  }

  removeSubtype(variantId: UnitType, subtype: UnitVariantId) {
    const sideState = this.sideState

    const { type, subtypes: requiredSubtypes } = parseVariantId(variantId)

    let sourceKey: UnitType | undefined
    for (const key of Object.keys(sideState.units) as UnitType[]) {
      if (sideState.units[key].length <= 0) continue
      const { type: kType, subtypes: kSubs } = parseVariantId(key)
      if (kType !== type) continue
      if (!kSubs.includes(subtype as UnitVariantId)) continue
      if (requiredSubtypes.every(s => kSubs.includes(s))) {
        sourceKey = key
        break
      }
    }
    if (!sourceKey) return

    const { subtypes: sourceSubs } = parseVariantId(sourceKey)
    const newSubtypes = sourceSubs.filter(s => s !== subtype)
    const newKey: UnitType =
      newSubtypes.length > 0 ? makeVariantId(type, newSubtypes) : type

    const movedId = sideState.units[sourceKey].pop()!
    if (sideState.units[sourceKey].length <= 0) {
      delete sideState.units[sourceKey]
    }

    if (!sideState.units[newKey]) {
      sideState.units[newKey] = []
    }
    sideState.units[newKey].push(movedId)
  }

  updateAbilityConfig(
    keyOrUpdates: string | Record<string, unknown>,
    maybeUpdates?: Record<string, unknown>,
  ) {
    const state = this.state
    const sideConfig = state.abilities[this._side]

    let targetKey: string
    let updates: Record<string, unknown>

    if (typeof keyOrUpdates === 'string') {
      targetKey = keyOrUpdates
      updates = maybeUpdates!
    } else {
      targetKey = this._abilityKey!
      updates = keyOrUpdates
    }

    if (!sideConfig[targetKey]) {
      sideConfig[targetKey] = {}
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
        abilitiesParams.syncInvokesForKey(this._side, targetKey, state)
      }

      if (targetKey === 'SETTINGS') {
        abilitiesParams.reconcileSettingsOnDraft(state)
      }
    }
  }

  modifyHitValue(amount: number, target?: unknown): void {
    const sideState = this.sideState
    if (!sideState.hitValueModifiers) {
      sideState.hitValueModifiers = []
    }
    const base = { amount, context: this.state.currentPhase.meta }

    if (target === undefined) {
      sideState.hitValueModifiers.push(base)
    } else if (typeof target === 'string') {
      sideState.hitValueModifiers.push({ ...base, unitType: target })
    } else if (
      typeof target === 'object' &&
      target !== null &&
      'exclude' in target
    ) {
      sideState.hitValueModifiers.push({
        ...base,
        excludeUnitTypes: (target as { exclude: string[] }).exclude,
      })
    } else {
      sideState.hitValueModifiers.push({
        ...base,
        unitId: target as UnitId,
      })
    }
  }
}

// ============================================================================
// CONTEXT BUILDERS (used by abilities-tracker)
// ============================================================================

/** Find the first UnitId for a base type (used by destroyUnit/removeUnit string overloads) */
function findFirstUnitId(
  sideState: SideStateData,
  baseType: UnitBaseType,
): { unitId: UnitId; key: UnitType } | undefined {
  for (const key of Object.keys(sideState.units) as UnitType[]) {
    const { type } = parseVariantId(key)
    if (type !== baseType) continue
    const ids = sideState.units[key]
    if (ids.length > 0) return { unitId: ids[0], key }
  }
  return undefined
}

/** Find variant key containing a UnitId (scans all keys) */
function findVariantKeyContaining(
  sideState: SideStateData,
  unitId: UnitId,
): UnitType | '' {
  for (const key of Object.keys(sideState.units) as UnitType[]) {
    if (sideState.units[key].includes(unitId)) return key
  }
  return ''
}

export class AbilityContext {
  logger?: Logger
  unitSource?: UnitId

  private _abilitiesParams: AbilitiesParams
  private _side: CombatSide
  private _draftState?: CombatStateData
  private _api: { own: SideApi; opponent: SideApi }

  constructor(side: CombatSide, abilitiesParams: AbilitiesParams) {
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
      ownAbilitiesParams: this._api.own._abilitiesParams,
      opponentAbilityKey: this._api.opponent._abilityKey,
      opponentAbilitiesParams: this._api.opponent._abilitiesParams,
    }
    fn()
    this.unitSource = saved.unitSource
    this.logger = saved.logger
    this._api.own._abilityKey = saved.ownAbilityKey
    this._api.own._abilitiesParams = saved.ownAbilitiesParams
    this._api.opponent._abilityKey = saved.opponentAbilityKey
    this._api.opponent._abilitiesParams = saved.opponentAbilitiesParams
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
