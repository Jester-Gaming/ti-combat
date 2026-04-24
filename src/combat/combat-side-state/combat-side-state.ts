import type { UnitCategory } from '@/constants/units'
import { UNIT_CATEGORIES, UNIT_LIMITS, UNIT_TYPES } from '@/constants/units'
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

import type { DeclaredSubtype, DicePool } from '../abilities-engine/types'
import type {
  CombatMode,
  CombatStateData,
  HitPool,
  HitSource,
  HitValueModifier,
  MetaPhase,
  PendingStep,
  RestrictionEntry,
  SideAbilitiesConfig,
  SideStateData,
  UnitAbilityRestrictions,
} from '../combat-state/types'
import { isDiceRollContext } from '../combat-state/types'
import { resolveUnitStats } from '../utils/resolve-unit-stats'
import { nextUnitIds } from '../utils/unit-id'
import {
  getVariantDisplayName,
  makeVariantId,
  parseVariantId,
} from '../utils/unit-variant'
import { getSettingsValidTargets as getSettingsValidTargetsUtil } from './get-settings-valid-targets'

/** Maps UnitCategory to the corresponding SETTINGS parameter key */
const CATEGORY_TO_SETTINGS_KEY: Record<UnitCategory, string> = {
  SHIPS: 'ships',
  NON_FIGHTER_SHIPS: 'nonFighterShips',
  GROUND_FORCES: 'groundForces',
  STRUCTURES: 'structures',
}

/** Shared empty destroyed record to avoid per-call {} allocation */
const EMPTY_DESTROYED: Record<string, UnitId[]> = {}

const liveAbilitiesSideHashCache = new WeakMap<SideAbilitiesConfig, string>()

function computeLiveAbilitiesHash(side: SideAbilitiesConfig): string {
  const cached = liveAbilitiesSideHashCache.get(side)
  if (cached !== undefined) return cached
  const keys = Object.keys(side).sort()
  const result =
    keys.length === 0
      ? ''
      : keys.map(k => `${k}:${JSON.stringify(side[k])}`).join(',')
  liveAbilitiesSideHashCache.set(side, result)
  return result
}

function hasValidTargets(hitPool: HitPool): boolean {
  return hitPool.validTargets !== undefined && hitPool.validTargets.length > 0
}

function matchesValidTargets(
  s: SideStateData,
  id: UnitId,
  validTargets: readonly UnitType[],
): boolean {
  const key = s.unitType[id]
  if (!key) return false
  if (validTargets.includes(key)) return true
  const baseType = parseVariantId(key).type as UnitType
  return validTargets.includes(baseType)
}

/** Pick destruction targets from `pool` for a single HitPool. */
function pickTargetsForPool(
  s: SideStateData,
  pool: readonly UnitId[],
  hitPool: HitPool,
  priorityList?: readonly UnitType[],
): UnitId[] {
  const total = hitPool.hits[0] + hitPool.hits[1]
  if (total <= 0 || pool.length === 0) return []

  if (!hasValidTargets(hitPool)) {
    const take = Math.min(total, pool.length)
    return pool.slice(pool.length - take)
  }

  const targets = hitPool.validTargets!
  const result: UnitId[] = []

  if (priorityList && priorityList.length > 0) {
    const targetSet = new Set<UnitType>(targets)
    for (const variantKey of priorityList) {
      if (result.length >= total) break
      if (!targetSet.has(variantKey)) {
        const baseType = parseVariantId(variantKey).type as UnitType
        if (!targetSet.has(baseType)) continue
      }
      for (let i = pool.length - 1; i >= 0 && result.length < total; i--) {
        const id = pool[i]
        if (s.unitType[id] !== variantKey) continue
        if (result.includes(id)) continue
        result.push(id)
      }
    }
    if (result.length >= total) return result
  }

  for (let i = pool.length - 1; i >= 0 && result.length < total; i--) {
    const id = pool[i]
    if (result.includes(id)) continue
    if (matchesValidTargets(s, id, targets)) result.push(id)
  }
  return result
}

function isCategoryMember(
  s: SideStateData,
  category: UnitCategory,
  baseType: string,
): boolean {
  const settings = CombatSideState.getLiveParams(s, 'SETTINGS')
  if (settings) {
    const key = CATEGORY_TO_SETTINGS_KEY[category]
    const list = settings[key] as UnitBaseType[] | undefined
    if (list) return list.includes(baseType as UnitBaseType)
  }
  return (UNIT_CATEGORIES[category] as readonly string[]).includes(baseType)
}

/** Check if the ability that sourced a restriction is itself disabled.
 *  Looks across both combat sides, both layers. Visited set prevents cycles. */
function isSourceDisabled(
  state: CombatStateData,
  reason: string,
  visited: Set<string>,
): boolean {
  if (visited.has(reason)) return false
  visited.add(reason)

  const ability = reason as UnitAbility
  for (const side of ['attacker', 'defender'] as const) {
    const restrictions = state[side].unitAbilityRestrictions
    if (!restrictions) continue

    for (const layer of ['lost', 'cannotBeUsed'] as const) {
      const entries = restrictions[layer]?.[ability]
      if (!entries || entries.length === 0) continue

      const hasValidEntry = entries.some(
        e => !isSourceDisabled(state, e.reason, visited),
      )
      if (hasValidEntry) return true
    }
  }
  return false
}

function _removeOne(
  s: SideStateData,
  unitTypeOrUnit: UnitBaseType | UnitId,
): void {
  let unitId: UnitId

  if (typeof unitTypeOrUnit === 'string') {
    const found = CombatSideState.findFirstUnitId(s, unitTypeOrUnit)
    if (!found) return
    unitId = found.unitId
  } else {
    unitId = unitTypeOrUnit
  }

  const pIdx = s.participatingUnits.indexOf(unitId)
  if (pIdx !== -1) {
    const copy = s.participatingUnits.slice()
    copy.splice(pIdx, 1)
    s.participatingUnits = copy
  } else {
    const nIdx = s.nonParticipatingUnits.indexOf(unitId)
    if (nIdx === -1) return
    const copy = s.nonParticipatingUnits.slice()
    copy.splice(nIdx, 1)
    s.nonParticipatingUnits = copy
  }

  delete s.unitState[unitId]
}

function addRestrictionEntry(
  restrictions: UnitAbilityRestrictions | undefined,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbility,
  reason: string,
  unitType?: UnitBaseType,
  category?: UnitCategory,
): UnitAbilityRestrictions {
  const current = restrictions ?? {}
  const layerData = current[layer] ?? {}
  const entries = layerData[ability] ?? []
  const entry: RestrictionEntry = { reason }
  if (unitType) entry.unitType = unitType
  if (category) entry.category = category

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
  category?: UnitCategory,
): UnitAbilityRestrictions | undefined {
  if (!restrictions) return undefined
  const layerData = restrictions[layer]
  if (!layerData) return restrictions
  const entries = layerData[ability]
  if (!entries) return restrictions

  const filtered = entries.filter(
    e =>
      e.reason !== reason || e.unitType !== unitType || e.category !== category,
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

function findPendingDiceRollGroup(
  pendingSteps: readonly PendingStep[],
  meta: MetaPhase,
): Extract<PendingStep, { kind: 'group' }> | undefined {
  for (let i = pendingSteps.length - 1; i >= 0; i--) {
    const s = pendingSteps[i]
    if (s.kind !== 'group' || !isDiceRollContext(s.data)) continue
    const inner = s.steps[s.steps.length - 1] ?? s.steps[0]
    if (inner && inner.phase[inner.phase.length - 1] === meta) return s
  }
  return undefined
}

/**
 * CombatSideState — namespace of all side operations.
 *
 * Every method is static and takes raw data as its first argument
 * (`SideStateData`, or `CombatStateData + side` when cross-side access is
 * needed). The class never allocates; it's purely a namespace so hot paths
 * like dice-outcome branching and hit assignment stay allocation-free.
 */
export class CombatSideState {
  // ==========================================================================
  // OPPONENT
  // ==========================================================================

  static getOpponentSide(side: CombatSide): CombatSide {
    return side === 'attacker' ? 'defender' : 'attacker'
  }

  // ==========================================================================
  // HASHING
  // ==========================================================================

  /** Hash this side's units (participating, non-participating, and
   *  per-unit mutable state) for state deduplication. */
  static getUnitsHash(s: SideStateData): string {
    return (
      s.participatingUnits.join(',') +
      '!' +
      s.nonParticipatingUnits.join(',') +
      '|' +
      JSON.stringify(s.unitState)
    )
  }

  /** Hash this side's `liveAbilities`. The initial `abilities` config is
   *  fixed for the whole combat so it never differentiates states; only
   *  runtime mutations (isEnabled, uses, ability-specific fields) matter
   *  for state identity. */
  static getAbilitiesHash(s: SideStateData): string {
    return computeLiveAbilitiesHash(s.liveAbilities)
  }

  /** Full identity hash for this side — units + runtime ability overlay. */
  static getHash(s: SideStateData): string {
    return `${CombatSideState.getUnitsHash(s)}+${CombatSideState.getAbilitiesHash(s)}`
  }

  // ==========================================================================
  // PRESENCE CHECKS
  // ==========================================================================

  /** True if the side still holds any participating unit. */
  static hasParticipatingUnits(s: SideStateData): boolean {
    return s.participatingUnits.length > 0
  }

  /** True if the side has any alive unit (participating or not). */
  static hasAnyUnits(s: SideStateData): boolean {
    return s.participatingUnits.length > 0 || s.nonParticipatingUnits.length > 0
  }

  /** Check if a specific UnitId is alive on this side. */
  static hasUnit(s: SideStateData, unitId: UnitId): boolean {
    return (
      s.participatingUnits.includes(unitId) ||
      s.nonParticipatingUnits.includes(unitId)
    )
  }

  /** Check if a unit type has any alive units. */
  static hasUnitType(
    s: SideStateData,
    unitType: UnitType,
    includeVariants?: boolean,
  ): boolean {
    const { participatingUnits, nonParticipatingUnits, unitType: typeMap } = s
    if (includeVariants) {
      const baseType = parseVariantId(unitType).type
      for (const id of participatingUnits) {
        if (parseVariantId(typeMap[id]).type === baseType) return true
      }
      for (const id of nonParticipatingUnits) {
        if (parseVariantId(typeMap[id]).type === baseType) return true
      }
      return false
    }
    for (const id of participatingUnits) {
      if (typeMap[id] === unitType) return true
    }
    for (const id of nonParticipatingUnits) {
      if (typeMap[id] === unitType) return true
    }
    return false
  }

  // ==========================================================================
  // UNIT LOOKUP
  // ==========================================================================

  /** Find variant key for a UnitId (empty string if not tracked). */
  static findVariantKey(s: SideStateData, unitId: UnitId): UnitType | '' {
    return s.unitType[unitId] ?? ''
  }

  /** Find the first (highest-priority) alive UnitId for a base type.
   *  Participating units are scanned first; non-participating are fallback. */
  static findFirstUnitId(
    s: SideStateData,
    baseType: UnitBaseType,
  ): { unitId: UnitId; key: UnitType } | undefined {
    const { participatingUnits, nonParticipatingUnits, unitType } = s
    for (const id of participatingUnits) {
      const key = unitType[id]
      if (parseVariantId(key).type === baseType) return { unitId: id, key }
    }
    for (const id of nonParticipatingUnits) {
      const key = unitType[id]
      if (parseVariantId(key).type === baseType) return { unitId: id, key }
    }
    return undefined
  }

  static findUnitByPriority(
    s: SideStateData,
    priority: UnitType[],
    participatingTypes?: ReadonlySet<UnitBaseType>,
    amount?: undefined,
  ): UnitId | undefined
  static findUnitByPriority(
    s: SideStateData,
    priority: UnitType[],
    participatingTypes: ReadonlySet<UnitBaseType> | undefined,
    amount: number,
  ): UnitId[]
  static findUnitByPriority(
    s: SideStateData,
    priority: UnitType[],
    participatingTypes?: ReadonlySet<UnitBaseType>,
    amount?: number,
  ): UnitId | UnitId[] | undefined {
    const { participatingUnits, nonParticipatingUnits, unitType } = s
    const collect = amount !== undefined
    const result: UnitId[] = []

    for (const variantId of priority) {
      const { type } = parseVariantId(variantId)
      if (participatingTypes && !participatingTypes.has(type)) continue
      for (const id of participatingUnits) {
        if (unitType[id] !== variantId) continue
        if (!collect) return id
        result.push(id)
        if (result.length >= amount) return result
      }
      for (const id of nonParticipatingUnits) {
        if (unitType[id] !== variantId) continue
        if (!collect) return id
        result.push(id)
        if (result.length >= amount) return result
      }
    }
    return collect ? result : undefined
  }

  /** Count units with optional filter and variant support.
   *  Counts across both participating and non-participating pools. */
  static countUnits(
    s: SideStateData,
    filter?: UnitType | UnitType[],
    includeVariants?: boolean,
  ): number {
    const { participatingUnits, nonParticipatingUnits, unitType } = s
    if (!filter) return participatingUnits.length + nonParticipatingUnits.length

    const filters = typeof filter === 'string' ? [filter] : filter

    if (includeVariants) {
      const baseTypes = new Set(filters.map(f => parseVariantId(f).type))
      let total = 0
      for (const id of participatingUnits) {
        if (baseTypes.has(parseVariantId(unitType[id]).type)) total++
      }
      for (const id of nonParticipatingUnits) {
        if (baseTypes.has(parseVariantId(unitType[id]).type)) total++
      }
      return total
    }

    const keys = new Set(filters)
    let total = 0
    for (const id of participatingUnits) {
      if (keys.has(unitType[id])) total++
    }
    for (const id of nonParticipatingUnits) {
      if (keys.has(unitType[id])) total++
    }
    return total
  }

  /** Get all UnitIds for a type, optionally including variants.
   *  Participating ids are returned first (in priority-sort order). */
  static getUnits(
    s: SideStateData,
    unitType: UnitType,
    includeVariants?: boolean,
  ): UnitId[] {
    const { participatingUnits, nonParticipatingUnits, unitType: typeMap } = s
    const result: UnitId[] = []
    if (includeVariants) {
      const baseType = parseVariantId(unitType).type
      for (const id of participatingUnits) {
        if (parseVariantId(typeMap[id]).type === baseType) result.push(id)
      }
      for (const id of nonParticipatingUnits) {
        if (parseVariantId(typeMap[id]).type === baseType) result.push(id)
      }
      return result
    }
    for (const id of participatingUnits) {
      if (typeMap[id] === unitType) result.push(id)
    }
    for (const id of nonParticipatingUnits) {
      if (typeMap[id] === unitType) result.push(id)
    }
    return result
  }

  /** Get UnitState for a UnitId. */
  static getUnitState(s: SideStateData, unitId: UnitId): UnitState | undefined {
    if (!CombatSideState.hasUnit(s, unitId)) return undefined
    return s.unitState[unitId] ?? {}
  }

  /** Get base type for a UnitId. */
  static getUnitBaseType(
    s: SideStateData,
    unitId: UnitId,
  ): UnitBaseType | undefined {
    const key = s.unitType[unitId]
    if (!key) return undefined
    return parseVariantId(key).type as UnitBaseType
  }

  /** Get variant key for a UnitId (undefined if not tracked). */
  static getUnitVariant(
    s: SideStateData,
    unitId: UnitId,
  ): UnitType | undefined {
    return s.unitType[unitId]
  }

  /** Get all active base types (types with at least one alive unit). */
  static getActiveBaseTypes(s: SideStateData): UnitBaseType[] {
    const { participatingUnits, nonParticipatingUnits, unitType } = s
    const types = new Set<UnitBaseType>()
    for (const id of participatingUnits) {
      types.add(parseVariantId(unitType[id]).type as UnitBaseType)
    }
    for (const id of nonParticipatingUnits) {
      types.add(parseVariantId(unitType[id]).type as UnitBaseType)
    }
    return [...types]
  }

  // ==========================================================================
  // HIT POOL HELPERS
  // ==========================================================================

  /** Sum pending hit pools. Without a filter returns base + bonus. */
  static getPendingHits(
    s: SideStateData,
    filter?: { base?: true; bonus?: true },
  ): number {
    const b = !filter || filter.base
    const n = !filter || filter.bonus
    return s.hitPools.reduce(
      (sum, pool) => sum + (b ? pool.hits[0] : 0) + (n ? pool.hits[1] : 0),
      0,
    )
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  /** Resolve unit stats for a variant key */
  static resolveUnitStats(
    s: SideStateData,
    key: UnitType,
  ): UnitStats | undefined {
    return resolveUnitStats(s.unitStats, key)
  }

  /** Get unit stats by variant key or UnitId */
  static getUnitStats(
    s: SideStateData,
    unitTypeOrId: string | UnitId,
  ): UnitStats | undefined {
    if (typeof unitTypeOrId === 'string') {
      const stats = resolveUnitStats(s.unitStats, unitTypeOrId as UnitType)
      if (stats) return stats
      const { type } = parseVariantId(unitTypeOrId as UnitType)
      if (type !== unitTypeOrId) {
        return resolveUnitStats(s.unitStats, type)
      }
      return undefined
    }
    const key = CombatSideState.findVariantKey(s, unitTypeOrId)
    if (!key) return undefined
    return resolveUnitStats(s.unitStats, key)
  }

  // ==========================================================================
  // LIVE PARAMS / SETTINGS
  // ==========================================================================

  /** Merge base ability config with any live overlay for this side. */
  static getLiveParams(
    s: SideStateData,
    abilityKey: string,
  ): Record<string, unknown> | undefined {
    const live = s.liveAbilities[abilityKey]
    if (live === undefined) return s.abilities[abilityKey]
    const base = s.abilities[abilityKey]
    if (base === undefined) return live
    return { ...base, ...live }
  }

  /** Get participating base types from SETTINGS ability as a Set.
   *  Hot path — inlined merge. */
  static getParticipatingUnits(
    s: SideStateData,
    mode: CombatMode,
  ): ReadonlySet<UnitBaseType> {
    const liveSettings = s.liveAbilities['SETTINGS']
    const baseSettings = s.abilities['SETTINGS']
    const settings =
      liveSettings === undefined
        ? baseSettings
        : baseSettings === undefined
          ? liveSettings
          : { ...baseSettings, ...liveSettings }

    if (!settings) throw new Error('No SETTINGS in getParticipatingUnits')

    const units =
      mode === 'GROUND'
        ? (settings.groundCombatParticipating as UnitBaseType[])
        : (settings.spaceCombatParticipating as UnitBaseType[])

    return new Set(units)
  }

  /** Get participating unit types from SETTINGS. */
  static getParticipatingUnitTypes(
    s: SideStateData,
    mode: CombatMode,
  ): UnitBaseType[] {
    const settings = CombatSideState.getLiveParams(s, 'SETTINGS')
    if (!settings) {
      const { participatingUnits, unitType } = s
      const types = new Set<UnitBaseType>()
      for (const id of participatingUnits) {
        types.add(parseVariantId(unitType[id]).type as UnitBaseType)
      }
      return [...types]
    }
    return mode === 'GROUND'
      ? ((settings.groundCombatParticipating as UnitBaseType[]) ?? [])
      : ((settings.spaceCombatParticipating as UnitBaseType[]) ?? [])
  }

  /** Get all unit types (participating + structures) */
  static getAllUnitTypes(): UnitBaseType[] {
    return [...new Set(UNIT_TYPES)]
  }

  /** Pick the sacrifice-priority list for `side` during `meta`. */
  static getPhasePriorityList(
    s: SideStateData,
    mode: CombatMode,
    meta: MetaPhase,
  ): UnitType[] | undefined {
    const baseUP = s.abilities['UNIT_PRIORITY']
    const liveUP = s.liveAbilities['UNIT_PRIORITY']
    if (baseUP === undefined && liveUP === undefined) return undefined
    const unitPriority =
      liveUP === undefined
        ? baseUP
        : baseUP === undefined
          ? liveUP
          : { ...baseUP, ...liveUP }
    if (!unitPriority) return undefined
    const key =
      meta === 'SPACE_CANNON_OFFENSE'
        ? 'scoUnitPriority'
        : mode === 'GROUND'
          ? 'groundUnitPriority'
          : 'spaceUnitPriority'
    return unitPriority[key] as UnitType[] | undefined
  }

  /** Get valid targets from SETTINGS for the given meta. Throws when
   *  SETTINGS is absent. */
  static getValidTargetsForPhase(
    s: SideStateData,
    meta: MetaPhase,
  ): UnitBaseType[] {
    const settings = CombatSideState.getLiveParams(s, 'SETTINGS')
    if (!settings) throw new Error('No SETTINGS in getValidTargetsForPhase')
    return getSettingsValidTargetsUtil(settings, meta)
  }

  /** Resolve valid targets from SETTINGS for the given meta. Returns [] when
   *  SETTINGS is absent (ability-context variant). */
  static getSettingsValidTargets(
    s: SideStateData,
    meta: MetaPhase,
  ): UnitBaseType[] {
    const settings = CombatSideState.getLiveParams(s, 'SETTINGS')
    if (!settings) return []
    return getSettingsValidTargetsUtil(settings, meta)
  }

  /** Get hit pool valid targets (falls back to settings valid targets) */
  static getHitPoolValidTargets(s: SideStateData, meta: MetaPhase): UnitType[] {
    const pool = s.hitPools[0]
    if (pool && pool.validTargets && pool.validTargets.length > 0)
      return pool.validTargets
    return CombatSideState.getSettingsValidTargets(s, meta)
  }

  // ==========================================================================
  // VARIANT OPTIONS
  // ==========================================================================

  static getUnitVariants(
    s: SideStateData,
    mode: CombatMode,
    filter?: {
      include?: UnitType[]
      exclude?: UnitType[]
      excludeSubtypes?: string[]
      excludeSubtypeSource?: string[]
      includeSubtypes?: string[]
      combatMode?: CombatMode
      includeNonParticipating?: boolean
    },
  ): UnitType[] {
    const baseTypes = filter?.includeNonParticipating
      ? CombatSideState.getAllUnitTypes()
      : CombatSideState.getParticipatingUnitTypes(s, filter?.combatMode ?? mode)
    const settings = CombatSideState.getLiveParams(s, 'SETTINGS')
    const allDeclaredSubtypes = (settings?.subtypes ?? []) as DeclaredSubtype[]
    const excludedSources = filter?.excludeSubtypeSource
      ? new Set<string>(filter.excludeSubtypeSource)
      : undefined
    const declaredSubtypes = excludedSources
      ? allDeclaredSubtypes.filter(
          d => d.source === undefined || !excludedSources.has(d.source),
        )
      : allDeclaredSubtypes

    const baseSet = new Set<string>(baseTypes)
    const result: UnitType[] = [...baseTypes]
    const addedSet = new Set<string>(baseTypes)
    for (const decl of declaredSubtypes) {
      const { type, subtypes: parentSubs } = parseVariantId(decl.unitType)
      if (!baseSet.has(decl.unitType) && !addedSet.has(decl.unitType)) continue
      const variantId = makeVariantId(type, [
        ...parentSubs,
        decl.name as UnitVariantId,
      ])
      if (addedSet.has(variantId)) continue
      let insertIdx = result.length
      for (let i = result.length - 1; i >= 0; i--) {
        if (
          result[i] === decl.unitType ||
          result[i].startsWith(decl.unitType + ':')
        ) {
          insertIdx = i + 1
          break
        }
      }
      result.splice(insertIdx, 0, variantId)
      addedSet.add(variantId)
    }

    const includeParsed = filter?.include?.map(v => parseVariantId(v))
    const excludeParsed = filter?.exclude?.map(v => parseVariantId(v))
    const excludeSubtypeSet = filter?.excludeSubtypes
      ? new Set<string>(filter.excludeSubtypes)
      : undefined
    const includeSubtypeSet =
      filter?.includeSubtypes && filter.includeSubtypes.length > 0
        ? new Set<string>(filter.includeSubtypes)
        : undefined
    const matches = (
      variantParsed: { type: UnitBaseType; subtypes: UnitVariantId[] },
      entry: { type: UnitBaseType; subtypes: UnitVariantId[] },
    ) => {
      if (variantParsed.type !== entry.type) return false
      if (entry.subtypes.length === 0) return true
      const vSubs = new Set<string>(variantParsed.subtypes)
      return entry.subtypes.every(s => vSubs.has(s))
    }

    let filtered = result
    if (includeParsed && includeParsed.length > 0) {
      filtered = filtered.filter(v => {
        const p = parseVariantId(v)
        return includeParsed.some(e => matches(p, e))
      })
    }
    if (excludeParsed && excludeParsed.length > 0) {
      filtered = filtered.filter(v => {
        const p = parseVariantId(v)
        return !excludeParsed.some(e => matches(p, e))
      })
    }
    if (excludeSubtypeSet) {
      filtered = filtered.filter(v => {
        const { subtypes } = parseVariantId(v)
        return !subtypes.some(sub => excludeSubtypeSet.has(sub))
      })
    }
    if (includeSubtypeSet) {
      filtered = filtered.filter(v => {
        const { subtypes } = parseVariantId(v)
        return subtypes.some(sub => includeSubtypeSet.has(sub))
      })
    }
    return filtered
  }

  static getUnitVariantOptions(
    s: SideStateData,
    mode: CombatMode,
    filter?: {
      include?: UnitType[]
      exclude?: UnitType[]
      excludeSubtypes?: string[]
      excludeSubtypeSource?: string[]
      includeSubtypes?: string[]
      combatMode?: CombatMode
      includeNonParticipating?: boolean
    },
  ): { label: string; value: UnitType }[] {
    return CombatSideState.getUnitVariants(s, mode, filter).map(id => ({
      label: getVariantDisplayName(id),
      value: id,
    }))
  }

  // ==========================================================================
  // RESTRICTIONS (queries)
  // ==========================================================================

  /** Check if a unit ability is restricted (variant-aware, category-aware) */
  static isRestricted(
    state: CombatStateData,
    side: CombatSide,
    layer: 'lost' | 'cannotBeUsed',
    ability: UnitAbility,
    unitType: string,
  ): boolean {
    const s = state[side]
    const entries = s.unitAbilityRestrictions?.[layer]?.[ability]
    if (!entries) return false
    const { type: baseType } = parseVariantId(unitType as UnitType)
    const visited = new Set<string>()
    return entries.some(e => {
      if (e.unitType && e.unitType !== unitType && e.unitType !== baseType)
        return false
      if (e.category && !isCategoryMember(s, e.category, baseType)) return false
      if (isSourceDisabled(state, e.reason, visited)) return false
      return true
    })
  }

  /** Check if a unit ability is fully blocked by a blanket restriction */
  static isAbilityBlocked(
    state: CombatStateData,
    side: CombatSide,
    ability: UnitAbility,
  ): boolean {
    const s = state[side]
    for (const layer of ['lost', 'cannotBeUsed'] as const) {
      const entries = s.unitAbilityRestrictions?.[layer]?.[ability]
      if (!entries) continue
      const visited = new Set<string>()
      if (
        entries.some(
          e =>
            !e.unitType &&
            !e.category &&
            !isSourceDisabled(state, e.reason, visited),
        )
      ) {
        return true
      }
    }
    return false
  }

  // ==========================================================================
  // DICE COLLECTION
  // ==========================================================================

  static collectDice(
    state: CombatStateData,
    side: CombatSide,
    source: HitSource,
    allowedUnitTypes?: ReadonlySet<UnitBaseType>,
  ): DicePool {
    const s = state[side]
    const participatingTypes = CombatSideState.getParticipatingUnits(
      s,
      state.combatMode,
    )
    const result: DicePool = {}

    const scanNonParticipating =
      source === 'SPACE_CANNON' || source === 'BOMBARDMENT'

    const variantStatsCache = new Map<
      UnitType,
      readonly [number, number, number] | null
    >()
    const restrictionChecked = new Map<UnitBaseType, boolean>()

    const walk = (pool: UnitId[], skipParticipatingCheck: boolean) => {
      for (const id of pool) {
        const key = s.unitType[id]
        const { type } = parseVariantId(key)

        if (allowedUnitTypes && !allowedUnitTypes.has(type)) continue
        if (!skipParticipatingCheck && !participatingTypes.has(type)) continue

        if (source !== 'COMBAT') {
          let allowed = restrictionChecked.get(type)
          if (allowed === undefined) {
            allowed = !(
              CombatSideState.isRestricted(state, side, 'lost', source, type) ||
              CombatSideState.isRestricted(
                state,
                side,
                'cannotBeUsed',
                source,
                type,
              )
            )
            restrictionChecked.set(type, allowed)
          }
          if (!allowed) continue
        }

        let die = variantStatsCache.get(key)
        if (die === undefined) {
          const stats = resolveUnitStats(s.unitStats, key)
          const dieData =
            source === 'COMBAT'
              ? stats?.COMBAT
              : stats?.UNIT_ABILITIES?.[source]
          if (!dieData) {
            variantStatsCache.set(key, null)
            continue
          }
          const [hitValue, dicePerUnit, bonusDice = 0] = dieData
          if (dicePerUnit + bonusDice <= 0) {
            variantStatsCache.set(key, null)
            continue
          }
          die = [hitValue, dicePerUnit, bonusDice]
          variantStatsCache.set(key, die)
        }
        if (die === null) continue

        const [hitValue, dicePerUnit, bonusDice] = die
        const arr = result[type] ?? (result[type] = [])
        arr.push([hitValue, dicePerUnit, bonusDice, id])
      }
    }

    walk(s.participatingUnits, true)
    if (scanNonParticipating) {
      walk(s.nonParticipatingUnits, true)
    }

    return result
  }

  // ==========================================================================
  // ASSIGN HITS
  // ==========================================================================

  /** Assign hits to this side. Replaces `participatingUnits` with a new array
   *  (does NOT mutate the original — safe for shared branch data). */
  static assignHits(
    s: SideStateData,
    trackDestroyed?: boolean,
    priorityList?: readonly UnitType[],
  ): Record<string, UnitId[]> {
    if (s.hitPools.length === 0) return EMPTY_DESTROYED

    const allFast = s.hitPools.every(p => !hasValidTargets(p))
    let total = 0
    for (const pool of s.hitPools) {
      total += pool.hits[0] + pool.hits[1]
    }
    if (total === 0) {
      s.hitPools = []
      return EMPTY_DESTROYED
    }

    const oldUnits = s.participatingUnits
    const destroyedIds: UnitId[] = []

    if (allFast) {
      const take = Math.min(total, oldUnits.length)
      const kept = oldUnits.length - take
      s.participatingUnits = oldUnits.slice(0, kept)
      if (trackDestroyed) {
        for (let i = kept; i < oldUnits.length; i++)
          destroyedIds.push(oldUnits[i])
      }
    } else {
      const working = oldUnits.slice()
      for (const pool of s.hitPools) {
        const picks = pickTargetsForPool(s, working, pool, priorityList)
        for (const id of picks) {
          const idx = working.indexOf(id)
          if (idx === -1) continue
          working.splice(idx, 1)
          if (trackDestroyed) destroyedIds.push(id)
        }
      }
      s.participatingUnits = working
    }

    s.hitPools = []

    if (!trackDestroyed) return EMPTY_DESTROYED

    const destroyed: Record<string, UnitId[]> = {}
    for (const id of destroyedIds) {
      const key = s.unitType[id]
      ;(destroyed[key] ??= []).push(id)
    }
    return destroyed
  }

  /** Simulate resolving a single HitPool against this side's current units. */
  static getAssignHitsTargets(
    s: SideStateData,
    hitPool: HitPool,
    priorityList?: readonly UnitType[],
  ): UnitId[] {
    return pickTargetsForPool(s, s.participatingUnits, hitPool, priorityList)
  }

  // ==========================================================================
  // HIT POOLS (mutations)
  // ==========================================================================

  /** Add a hit pool (ability-produced hits go into bonus slot) */
  static addHits(
    s: SideStateData,
    hits: number,
    validTargets: UnitType[],
  ): void {
    if (hits === 0) return
    s.hitPools.push({ hits: [0, hits], validTargets })
  }

  /** Add a hit pool from a combat dice-roll outcome (hits in base slot). */
  static addBaseHits(
    s: SideStateData,
    hits: number,
    validTargets: UnitType[],
  ): void {
    if (hits <= 0) return
    s.hitPools.push({ hits: [hits, 0], validTargets })
  }

  /** Reduce pending hits from hit pools (reduces bonus first, then base) */
  static reduceHits(s: SideStateData, amount: number): void {
    if (s.hitPools.length === 0 || amount <= 0) return
    let remaining = amount
    for (const pool of s.hitPools) {
      const total = pool.hits[0] + pool.hits[1]
      const reduce = Math.min(remaining, total)
      const bonusReduce = Math.min(reduce, pool.hits[1])
      const baseReduce = reduce - bonusReduce
      pool.hits = [pool.hits[0] - baseReduce, pool.hits[1] - bonusReduce]
      remaining -= reduce
      if (remaining <= 0) break
    }
  }

  // ==========================================================================
  // UNIT MUTATIONS
  // ==========================================================================

  /** Remove one or more units by UnitId, UnitId[], or base type (first found). */
  static removeUnits(
    s: SideStateData,
    target: UnitBaseType | UnitId | UnitId[],
  ): void {
    if (Array.isArray(target)) {
      for (const id of target) _removeOne(s, id)
      return
    }
    _removeOne(s, target)
  }

  /** Modify per-unit mutable state */
  static modifyUnitState(
    s: SideStateData,
    unitId: UnitId,
    updates: Partial<UnitState>,
  ): void {
    s.unitState[unitId] ??= {}
    Object.assign(s.unitState[unitId], updates)
  }

  /** Move one unit to a new variant with an added subtype. */
  static addSubtype(
    s: SideStateData,
    variantId: UnitType,
    subtype: UnitVariantId,
    statsFactory?: (parentStats: UnitStats) => UnitStats,
  ): void {
    const { type, subtypes: currentSubtypes } = parseVariantId(variantId)

    const pickFrom = (
      pool: UnitId[],
      matchExact: boolean,
    ): UnitId | undefined => {
      for (let i = pool.length - 1; i >= 0; i--) {
        const id = pool[i]
        const key = s.unitType[id]
        if (matchExact ? key === variantId : parseVariantId(key).type === type)
          return id
      }
      return undefined
    }
    const pickedId =
      pickFrom(s.participatingUnits, true) ??
      pickFrom(s.nonParticipatingUnits, true) ??
      pickFrom(s.participatingUnits, false) ??
      pickFrom(s.nonParticipatingUnits, false)
    if (pickedId === undefined) return

    const sourceKey = s.unitType[pickedId]
    const newSubtypes = [...currentSubtypes, subtype].sort()
    const newKey = makeVariantId(type, newSubtypes as UnitVariantId[])
    if (newKey === sourceKey) return

    s.unitType = { ...s.unitType, [pickedId]: newKey }

    if (!s.unitStats[newKey]) {
      let value: UnitStats | ((parentStats: UnitStats) => UnitStats) | undefined
      if (statsFactory) {
        value = statsFactory
      } else {
        const sourceStats =
          resolveUnitStats(s.unitStats, sourceKey) ??
          resolveUnitStats(s.unitStats, type)
        if (sourceStats) value = { ...sourceStats }
      }
      if (value !== undefined) {
        s.unitStats = { ...s.unitStats, [newKey]: value }
      }
    }
  }

  /** Move one unit to a variant with a subtype removed. */
  static removeSubtype(
    s: SideStateData,
    variantId: UnitType,
    subtype: UnitVariantId,
  ): void {
    const { type, subtypes: requiredSubtypes } = parseVariantId(variantId)

    const findIn = (pool: UnitId[]): UnitId | undefined => {
      for (let i = pool.length - 1; i >= 0; i--) {
        const id = pool[i]
        const key = s.unitType[id]
        const { type: kType, subtypes: kSubs } = parseVariantId(key)
        if (kType !== type) continue
        if (!kSubs.includes(subtype as UnitVariantId)) continue
        if (requiredSubtypes.every(sub => kSubs.includes(sub))) return id
      }
      return undefined
    }
    const pickedId =
      findIn(s.participatingUnits) ?? findIn(s.nonParticipatingUnits)
    if (pickedId === undefined) return

    const sourceKey = s.unitType[pickedId]
    const { subtypes: sourceSubs } = parseVariantId(sourceKey)
    const newSubtypes = sourceSubs.filter(sub => sub !== subtype)
    const newKey: UnitType =
      newSubtypes.length > 0 ? makeVariantId(type, newSubtypes) : type

    if (newKey === sourceKey) return

    s.unitType = { ...s.unitType, [pickedId]: newKey }
  }

  /**
   * Modify stats for a unit type. Returns variant keys that had ABILITIES
   * changes (for engine to queue invokes).
   */
  static modifyUnitType(
    s: SideStateData,
    key: UnitType,
    updates: Partial<UnitStats>,
  ): { keysWithAbilitiesChange: { key: UnitType; ids: UnitId[] }[] } {
    const { type } = parseVariantId(key)
    const isVariantKey = key.includes(':')
    const hasAbilitiesUpdate = 'ABILITIES' in updates

    if (isVariantKey) {
      if (s.unitStats[key]) {
        if (typeof s.unitStats[key] === 'function') {
          s.unitStats[key] = resolveUnitStats(s.unitStats, key)!
        }
        Object.assign(s.unitStats[key], updates)
      }
    } else {
      for (const vKey of Object.keys(s.unitStats) as UnitType[]) {
        const { type: vType } = parseVariantId(vKey)
        if (vType !== type) continue
        if (!s.unitStats[vKey]) continue
        if (typeof s.unitStats[vKey] === 'function') continue
        Object.assign(s.unitStats[vKey], updates)
      }
    }

    if (!hasAbilitiesUpdate) return { keysWithAbilitiesChange: [] }

    const buckets = new Map<UnitType, UnitId[]>()
    const bucketize = (pool: UnitId[]) => {
      for (const id of pool) {
        const vKey = s.unitType[id]
        if (isVariantKey) {
          if (vKey !== key) continue
        } else {
          if (parseVariantId(vKey).type !== type) continue
        }
        let bucket = buckets.get(vKey)
        if (!bucket) buckets.set(vKey, (bucket = []))
        bucket.push(id)
      }
    }
    bucketize(s.participatingUnits)
    bucketize(s.nonParticipatingUnits)

    const keysWithAbilitiesChange: { key: UnitType; ids: UnitId[] }[] = []
    for (const [k, ids] of buckets)
      keysWithAbilitiesChange.push({ key: k, ids })
    return { keysWithAbilitiesChange }
  }

  /** Place new units. New UnitIds are appended to the pool matching the base
   *  type's participating status. */
  static placeUnits(
    s: SideStateData,
    mode: CombatMode,
    unitsToAdd: Partial<Record<UnitBaseType, number>>,
  ): Record<UnitType, UnitId[]> {
    const placed: Record<UnitType, UnitId[]> = {} as Record<UnitType, UnitId[]>
    const participatingTypes = new Set(
      CombatSideState.getParticipatingUnitTypes(s, mode),
    )

    let nextPart = s.participatingUnits
    let nextNon = s.nonParticipatingUnits
    let nextUnitType = s.unitType

    for (const [type, count] of Object.entries(unitsToAdd)) {
      const unitType_ = type as UnitBaseType
      if (!count || count <= 0) continue

      let existing = 0
      for (const id of s.participatingUnits) {
        if (parseVariantId(s.unitType[id]).type === unitType_) existing++
      }
      for (const id of s.nonParticipatingUnits) {
        if (parseVariantId(s.unitType[id]).type === unitType_) existing++
      }

      const limit = UNIT_LIMITS[unitType_]
      if (existing + count > limit) {
        console.warn(
          `Unit limit exceeded: ${unitType_} has a maximum of ${limit}`,
        )
      }
      const allowed = Math.min(count, limit - existing)
      if (allowed <= 0) continue

      const newIds = nextUnitIds(allowed)
      if (participatingTypes.has(unitType_)) {
        nextPart = [...nextPart, ...newIds]
      } else {
        nextNon = [...nextNon, ...newIds]
      }
      const typeMapAdditions: Record<UnitId, UnitType> = {}
      for (const id of newIds) typeMapAdditions[id] = unitType_
      nextUnitType = { ...nextUnitType, ...typeMapAdditions }

      if (!s.unitStats[unitType_]) {
        s.unitStats[unitType_] = {}
      }

      placed[unitType_] = newIds
    }

    s.participatingUnits = nextPart
    s.nonParticipatingUnits = nextNon
    s.unitType = nextUnitType

    return placed
  }

  // ==========================================================================
  // RESTRICTIONS (mutations)
  // ==========================================================================

  static addRestriction(
    s: SideStateData,
    layer: 'lost' | 'cannotBeUsed',
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ): void {
    const isCategory = target !== undefined && target in UNIT_CATEGORIES
    s.unitAbilityRestrictions = addRestrictionEntry(
      s.unitAbilityRestrictions,
      layer,
      ability,
      reason,
      isCategory ? undefined : (target as UnitBaseType),
      isCategory ? (target as UnitCategory) : undefined,
    )
  }

  static removeRestriction(
    s: SideStateData,
    layer: 'lost' | 'cannotBeUsed',
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ): void {
    const isCategory = target !== undefined && target in UNIT_CATEGORIES
    s.unitAbilityRestrictions = removeRestrictionEntry(
      s.unitAbilityRestrictions,
      layer,
      ability,
      reason,
      isCategory ? undefined : (target as UnitBaseType),
      isCategory ? (target as UnitCategory) : undefined,
    )
  }

  // ==========================================================================
  // HIT VALUE MODIFIER (needs pendingSteps)
  // ==========================================================================

  /** Add a hit-value modifier to the pending dice-roll group for `meta`. */
  static addHitValueModifier(
    pendingSteps: readonly PendingStep[],
    side: CombatSide,
    amount: number,
    target: unknown,
    meta: MetaPhase,
  ): void {
    const group = findPendingDiceRollGroup(pendingSteps, meta)
    if (!group) {
      throw new Error(
        `addHitValueModifier: no pending dice-roll group for meta ${meta}`,
      )
    }
    const ctx = group.data
    if (!isDiceRollContext(ctx)) {
      throw new Error(
        'addHitValueModifier: group data is not a DiceRollContext',
      )
    }
    if (!ctx.hitValueModifiers) ctx.hitValueModifiers = {}
    const list = (ctx.hitValueModifiers[side] ??= [])
    const base: HitValueModifier = { amount }

    if (target === undefined) {
      list.push(base)
    } else if (typeof target === 'string') {
      list.push({ ...base, unitType: target })
    } else if (
      typeof target === 'object' &&
      target !== null &&
      'exclude' in target
    ) {
      list.push({
        ...base,
        excludeUnitTypes: (target as { exclude: string[] }).exclude,
      })
    } else {
      list.push({
        ...base,
        unitId: target as UnitId,
      })
    }
  }
}

/** Standalone convenience re-export. Prefer `CombatSideState.getOpponentSide`
 *  for new code; this alias exists for ergonomic call sites that flip sides
 *  frequently (e.g. `getOpponentSide(this._side)`). */
export const getOpponentSide = CombatSideState.getOpponentSide
