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
import type { CombatState } from '../combat-state/combat-state'
import type {
  CombatMode,
  CombatStateData,
  HitPool,
  HitSource,
  HitValueModifier,
  MetaPhase,
  PendingStep,
  RestrictionEntry,
  SideStateData,
  UnitAbilityRestrictions,
} from '../combat-state/types'
import { isDiceRollContext } from '../combat-state/types'
import { nextUnitIds } from '../utils/unit-id'
import {
  getVariantDisplayName,
  makeVariantId,
  parseVariantId,
} from '../utils/unit-variant'

/** Maps UnitCategory to the corresponding SETTINGS parameter key */
const CATEGORY_TO_SETTINGS_KEY: Record<UnitCategory, string> = {
  SHIPS: 'ships',
  NON_FIGHTER_SHIPS: 'nonFighterShips',
  GROUND_FORCES: 'groundForces',
  STRUCTURES: 'structures',
}

/**
 * Resolve a unitStats entry to concrete UnitStats.
 * If the entry is a factory function, applies it to the nearest parent with
 * concrete stats (tries each one-subtype-removed variant, then base type).
 */
export function resolveUnitStats(
  unitStats: SideStateData['unitStats'],
  key: UnitType,
): UnitStats | undefined {
  const entry = unitStats[key]
  if (!entry) return undefined
  if (typeof entry === 'function') {
    const { type, subtypes } = parseVariantId(key)
    // Try each parent variant (remove one subtype at a time)
    for (let i = 0; i < subtypes.length; i++) {
      const parentSubs = [...subtypes.slice(0, i), ...subtypes.slice(i + 1)]
      const parentKey =
        parentSubs.length > 0 ? makeVariantId(type, parentSubs) : type
      const parentStats = resolveUnitStats(unitStats, parentKey)
      if (parentStats !== undefined) {
        return entry(parentStats)
      }
    }
    // Fallback: base type
    const baseEntry = unitStats[type]
    if (baseEntry !== undefined && typeof baseEntry !== 'function') {
      return entry(baseEntry)
    }
    return undefined
  }
  return entry
}

/** Total count across all variants of a base type */
function totalCountForType(
  units: Record<string, UnitId[]>,
  baseType: UnitBaseType,
): number {
  let total = 0
  for (const key of Object.keys(units)) {
    const { type } = parseVariantId(key as UnitType)
    if (type === baseType) total += units[key].length
  }
  return total
}

import { getSettingsValidTargets as getSettingsValidTargetsUtil } from './utils/get-settings-valid-targets'

/** Get the opposite side */
export function getOpponentSide(side: CombatSide): CombatSide {
  return side === 'attacker' ? 'defender' : 'attacker'
}

/** Walk `pendingSteps` in execution order (from top of stack downward) and
 *  return the first `DiceRollContext` group whose innermost phase matches
 *  `meta`. Used by `addHitValueModifier` to attach modifiers to the correct
 *  upcoming roll (current group for BEFORE_(UNIT_ABILITY_)?DICE_ROLL, next
 *  group in the script for START_OF_COMBAT / START_OF_COMBAT_ROUND). */
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

// Cache for getParticipatingUnits: source array → Set
const participatingUnitsCache = new WeakMap<
  UnitBaseType[],
  ReadonlySet<UnitBaseType>
>()

function getParticipatingUnitsSet(
  units: UnitBaseType[],
): ReadonlySet<UnitBaseType> {
  let cached = participatingUnitsCache.get(units)
  if (!cached) {
    cached = new Set(units)
    participatingUnitsCache.set(units, cached)
  }
  return cached
}

/** Shared empty destroyed record to avoid per-call {} allocation */
const EMPTY_DESTROYED: Record<string, UnitId[]> = {}

// Cache for filtered sacrifice order: unitPriority array → (participatingSet → filtered order)
const sacrificeOrderCache = new WeakMap<
  string[],
  Map<ReadonlySet<UnitBaseType>, string[]>
>()

function getFilteredSacrificeOrder(
  unitPriority: string[],
  participatingUnits: ReadonlySet<UnitBaseType>,
): string[] {
  let map = sacrificeOrderCache.get(unitPriority)
  if (map) {
    const cached = map.get(participatingUnits)
    if (cached) return cached
  }

  const result = unitPriority.filter(id => {
    const { type } = parseVariantId(id as UnitType)
    return participatingUnits.has(type)
  })

  if (!map) {
    map = new Map()
    sacrificeOrderCache.set(unitPriority, map)
  }
  map.set(participatingUnits, result)
  return result
}

/** Pre-computed parameters for hit assignment */
export interface AssignHitsParams {
  participatingUnits: ReadonlySet<UnitBaseType>
  sacrificeOrder: string[]
}

/** Compute hit assignment params for a side. Takes `stateData` + `side`
 *  directly (not a `CombatSideState`) because this is called millions of
 *  times per simulation — avoiding the method-call overhead on hot path. */
export function getAssignHitsParams(
  stateData: CombatStateData,
  side: CombatSide,
  meta: MetaPhase,
): AssignHitsParams {
  const baseSide = stateData.abilities[side]
  const liveSide = stateData.liveAbilities[side]

  const liveSettings = liveSide['SETTINGS']
  const baseSettings = baseSide['SETTINGS']
  const settings =
    liveSettings === undefined
      ? baseSettings
      : baseSettings === undefined
        ? liveSettings
        : { ...baseSettings, ...liveSettings }
  if (!settings) throw new Error('No SETTINGS in getAssignHitsParams')

  const combatMode = stateData.combatMode
  const units =
    combatMode === 'GROUND'
      ? (settings.groundCombatParticipating as UnitBaseType[])
      : (settings.spaceCombatParticipating as UnitBaseType[])

  const participatingUnits = getParticipatingUnitsSet(units)

  const liveUP = liveSide['UNIT_PRIORITY']
  const baseUP = baseSide['UNIT_PRIORITY']
  const unitPriority =
    liveUP === undefined
      ? baseUP
      : baseUP === undefined
        ? liveUP
        : { ...baseUP, ...liveUP }
  if (!unitPriority) throw new Error('No UNIT_PRIORITY in getAssignHitsParams')

  const key =
    combatMode === 'GROUND'
      ? 'groundUnitPriority'
      : meta === 'SPACE_CANNON_OFFENSE'
        ? 'scoUnitPriority'
        : 'spaceUnitPriority'
  const sacrificeOrder = getFilteredSacrificeOrder(
    unitPriority[key] as string[],
    participatingUnits,
  )

  return { participatingUnits, sacrificeOrder }
}

/** One variant's contribution to a hit-pool resolution plan. */
interface AssignHitsPlanEntry {
  variantId: UnitType
  ids: UnitId[]
}

/** Walk the sacrifice order once and compute which UnitIds would be destroyed
 *  by a single HitPool against the given units map. Used by both
 *  `assignHitsForSide` (needs variant grouping for removal) and
 *  `getAssignHitsTargets` (flattens to UnitId[]). */
function planAssignHits(
  units: SideStateData['units'],
  sacrificeOrder: string[],
  hitPool: HitPool,
): AssignHitsPlanEntry[] {
  const plan: AssignHitsPlanEntry[] = []
  let remaining = hitPool.hits[0] + hitPool.hits[1]
  if (remaining <= 0) return plan

  const { validTargets } = hitPool

  for (const variantId of sacrificeOrder) {
    if (remaining <= 0) break
    const vid = variantId as UnitType
    if (
      validTargets &&
      validTargets.length > 0 &&
      !validTargets.includes(vid) &&
      !validTargets.includes(parseVariantId(vid).type)
    )
      continue

    const ids = units[vid]
    if (!ids || ids.length <= 0) continue

    const toDestroy = Math.min(ids.length, remaining)
    const picked: UnitId[] = []
    for (let i = ids.length - toDestroy; i < ids.length; i++) {
      picked.push(ids[i])
    }
    plan.push({ variantId: vid, ids: picked })
    remaining -= toDestroy
  }

  return plan
}

/** Returns the UnitIds that would be destroyed if the given HitPool were
 *  resolved now against this side's current units. Non-destructive. */
export function getAssignHitsTargets(
  sideData: SideStateData,
  params: AssignHitsParams,
  hitPool: HitPool,
): UnitId[] {
  const plan = planAssignHits(sideData.units, params.sacrificeOrder, hitPool)
  const result: UnitId[] = []
  for (const { ids } of plan) {
    for (const id of ids) result.push(id)
  }
  return result
}

/** Standalone hit assignment — takes pre-computed params to avoid repeated lookups */
export function assignHitsForSide(
  sideData: SideStateData,
  params: AssignHitsParams,
  trackDestroyed?: boolean,
): Record<string, UnitId[]> {
  if (sideData.hitPools.length === 0) return EMPTY_DESTROYED

  let destroyed: Record<string, UnitId[]> | undefined
  let units = sideData.units

  for (const pool of sideData.hitPools) {
    if (pool.hits[0] + pool.hits[1] <= 0) continue

    const plan = planAssignHits(units, params.sacrificeOrder, pool)

    for (const { variantId, ids: toRemove } of plan) {
      if (trackDestroyed) {
        if (!destroyed) destroyed = {}
        if (!destroyed[variantId]) destroyed[variantId] = []
        for (const id of toRemove) destroyed[variantId].push(id)
      }

      const existing = units[variantId]
      const kept = existing.length - toRemove.length
      if (kept <= 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [variantId]: _removed, ...rest } = units
        units = rest as SideStateData['units']
      } else {
        units = { ...units, [variantId]: existing.slice(0, kept) }
      }
    }
  }

  sideData.units = units
  sideData.hitPools = []

  return destroyed ?? EMPTY_DESTROYED
}

/** Build a restriction entry */
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

/** Remove a restriction entry */
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

export class CombatSideState {
  private _combatState: CombatState
  private _side: CombatSide

  constructor(combatState: CombatState, side: CombatSide) {
    this._combatState = combatState
    this._side = side
  }

  private get stateData(): CombatStateData {
    return this._combatState.data
  }

  private get data(): SideStateData {
    return this.stateData[this._side]
  }

  get units() {
    return this.data.units
  }

  get hitPools() {
    return this.data.hitPools
  }

  get unitAbilityRestrictions() {
    return this.data.unitAbilityRestrictions
  }

  get side(): CombatSide {
    return this._side
  }

  get combatMode(): CombatMode {
    return this.stateData.combatMode
  }

  /** Merge base ability config with any live overlay for this side. Returns
   *  undefined if neither base nor live has an entry for `abilityKey`. The
   *  live overlay holds partial deltas (only fields written via
   *  `updateAbilityConfig` or `decrementUses`); fields not present in live
   *  fall through to base. */
  getLiveParams(abilityKey: string): Record<string, unknown> | undefined {
    const state = this.stateData
    const side = this._side
    const live = state.liveAbilities[side][abilityKey]
    if (live === undefined) return state.abilities[side][abilityKey]
    const base = state.abilities[side][abilityKey]
    if (base === undefined) return live
    return { ...base, ...live }
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  /** Find variant key containing a UnitId (scans all keys) */
  findVariantKey(unitId: UnitId): UnitType | '' {
    for (const key of Object.keys(this.data.units) as UnitType[]) {
      if (this.data.units[key].includes(unitId)) return key
    }
    return ''
  }

  /** Find the first UnitId for a base type */
  findFirstUnitId(
    baseType: UnitBaseType,
  ): { unitId: UnitId; key: UnitType } | undefined {
    for (const key of Object.keys(this.data.units) as UnitType[]) {
      const { type } = parseVariantId(key)
      if (type !== baseType) continue
      const ids = this.data.units[key]
      if (ids.length > 0) return { unitId: ids[0], key }
    }
    return undefined
  }

  /** Find first unit matching a priority list */
  findUnitByPriority(
    priority: UnitType[],
    participatingTypes?: ReadonlySet<UnitBaseType>,
    amount?: undefined,
  ): UnitId | undefined
  findUnitByPriority(
    priority: UnitType[],
    participatingTypes: ReadonlySet<UnitBaseType> | undefined,
    amount: number,
  ): UnitId[]
  findUnitByPriority(
    priority: UnitType[],
    participatingTypes?: ReadonlySet<UnitBaseType>,
    amount?: number,
  ): UnitId | UnitId[] | undefined {
    if (amount !== undefined) {
      const result: UnitId[] = []
      const seen = new Set<UnitId>()
      for (const variantId of priority) {
        const { type } = parseVariantId(variantId)
        if (participatingTypes && !participatingTypes.has(type)) continue
        const ids = this.data.units[variantId]
        if (!ids) continue
        for (const id of ids) {
          if (seen.has(id)) continue
          seen.add(id)
          result.push(id)
          if (result.length >= amount) return result
        }
      }
      return result
    }
    for (const variantId of priority) {
      const { type } = parseVariantId(variantId)
      if (participatingTypes && !participatingTypes.has(type)) continue
      const ids = this.data.units[variantId]
      if (!ids || ids.length <= 0) continue
      return ids[0]
    }
    return undefined
  }

  /** Count units with optional filter and variant support */
  countUnits(
    filter?: UnitType | UnitType[],
    includeVariants?: boolean,
  ): number {
    const data = this.data
    if (!filter) {
      let total = 0
      for (const key of Object.keys(data.units)) {
        total += data.units[key as UnitType].length
      }
      return total
    }

    const filters = typeof filter === 'string' ? [filter] : filter

    if (includeVariants) {
      const baseTypes = new Set(filters.map(f => parseVariantId(f).type))
      let total = 0
      for (const key of Object.keys(data.units) as UnitType[]) {
        const ids = data.units[key]
        if (ids.length <= 0) continue
        if (baseTypes.has(parseVariantId(key).type)) {
          total += ids.length
        }
      }
      return total
    }

    let total = 0
    for (const f of filters) {
      total += data.units[f]?.length ?? 0
    }
    return total
  }

  /** Sum pending hit pools. Without a filter returns base + bonus. */
  getPendingHits(filter?: { base?: true; bonus?: true }): number {
    const b = !filter || filter.base
    const n = !filter || filter.bonus
    return this.data.hitPools.reduce(
      (sum, pool) => sum + (b ? pool.hits[0] : 0) + (n ? pool.hits[1] : 0),
      0,
    )
  }

  /** Check if a unit ability is restricted (variant-aware, category-aware) */
  isRestricted(
    layer: 'lost' | 'cannotBeUsed',
    ability: UnitAbility,
    unitType: string,
  ): boolean {
    const entries = this.data.unitAbilityRestrictions?.[layer]?.[ability]
    if (!entries) return false
    const { type: baseType } = parseVariantId(unitType as UnitType)
    const visited = new Set<string>()
    return entries.some(e => {
      if (e.unitType && e.unitType !== unitType && e.unitType !== baseType) {
        return false
      }
      if (e.category && !this.isCategoryMember(e.category, baseType)) {
        return false
      }
      if (this.isSourceDisabled(e.reason, visited)) return false
      return true
    })
  }

  /** Check if a unit ability is fully blocked by a blanket restriction */
  isAbilityBlocked(ability: UnitAbility): boolean {
    for (const layer of ['lost', 'cannotBeUsed'] as const) {
      const entries = this.data.unitAbilityRestrictions?.[layer]?.[ability]
      if (!entries) continue
      const visited = new Set<string>()
      if (
        entries.some(
          e =>
            !e.unitType &&
            !e.category &&
            !this.isSourceDisabled(e.reason, visited),
        )
      ) {
        return true
      }
    }
    return false
  }

  /** Check if a unit type belongs to a category using runtime SETTINGS */
  private isCategoryMember(category: UnitCategory, baseType: string): boolean {
    const settings = this.getLiveParams('SETTINGS')
    if (settings) {
      const key = CATEGORY_TO_SETTINGS_KEY[category]
      const list = settings[key] as UnitBaseType[] | undefined
      if (list) return list.includes(baseType as UnitBaseType)
    }
    return (UNIT_CATEGORIES[category] as readonly string[]).includes(baseType)
  }

  /**
   * Check if the ability that sourced a restriction is itself disabled.
   * Looks across both combat sides, both layers (lost + cannotBeUsed).
   * Uses a visited set to prevent cycles.
   */
  private isSourceDisabled(reason: string, visited: Set<string>): boolean {
    if (visited.has(reason)) return false
    visited.add(reason)

    const ability = reason as UnitAbility
    for (const side of ['attacker', 'defender'] as const) {
      const sideState = this._combatState.side(side)
      const restrictions = sideState.data.unitAbilityRestrictions
      if (!restrictions) continue

      for (const layer of ['lost', 'cannotBeUsed'] as const) {
        const entries = restrictions[layer]?.[ability]
        if (!entries || entries.length === 0) continue

        const hasValidEntry = entries.some(
          e => !sideState.isSourceDisabled(e.reason, visited),
        )
        if (hasValidEntry) return true
      }
    }
    return false
  }

  /** Get all UnitIds for a type, optionally including variants */
  getUnits(unitType: UnitType, includeVariants?: boolean): UnitId[] {
    const data = this.data
    if (includeVariants) {
      const result: UnitId[] = []
      for (const key of Object.keys(data.units) as UnitType[]) {
        const { type } = parseVariantId(key)
        if (type === unitType) {
          result.push(...data.units[key])
        }
      }
      return result
    }
    return data.units[unitType] ?? []
  }

  /** Check if a specific UnitId exists */
  hasUnit(unitId: UnitId): boolean {
    return this.findVariantKey(unitId) !== ''
  }

  /** Check if a unit type has any units */
  hasUnitType(unitType: UnitType, includeVariants?: boolean): boolean {
    if (includeVariants) {
      return (
        totalCountForType(this.data.units, parseVariantId(unitType).type) > 0
      )
    }
    const ids = this.data.units[unitType]
    return !!ids && ids.length > 0
  }

  /** Get all active base types (types with at least one unit) */
  getActiveBaseTypes(): UnitBaseType[] {
    const types = new Set<UnitBaseType>()
    for (const key of Object.keys(this.data.units) as UnitType[]) {
      if (this.data.units[key].length <= 0) continue
      const { type } = parseVariantId(key)
      types.add(type)
    }
    return [...types]
  }

  /** Resolve unit stats for a variant key */
  resolveUnitStats(key: UnitType): UnitStats | undefined {
    return resolveUnitStats(this.data.unitStats, key)
  }

  /** Get unit stats by variant key or UnitId */
  getUnitStats(unitTypeOrId: string | UnitId): UnitStats | undefined {
    const data = this.data
    if (typeof unitTypeOrId === 'string') {
      const stats = resolveUnitStats(data.unitStats, unitTypeOrId as UnitType)
      if (stats) return stats
      const { type } = parseVariantId(unitTypeOrId as UnitType)
      if (type !== unitTypeOrId) {
        return resolveUnitStats(data.unitStats, type)
      }
      return undefined
    }
    const key = this.findVariantKey(unitTypeOrId)
    if (!key) return undefined
    return resolveUnitStats(data.unitStats, key)
  }

  /** Get UnitState for a UnitId */
  getUnitState(unitId: UnitId): UnitState | undefined {
    const key = this.findVariantKey(unitId)
    if (!key) return undefined
    return this.data.unitState[unitId] ?? {}
  }

  /** Get base type for a UnitId */
  getUnitBaseType(unitId: UnitId): UnitBaseType | undefined {
    const key = this.findVariantKey(unitId)
    if (!key) return undefined
    return parseVariantId(key).type as UnitBaseType
  }

  /** Get variant key for a UnitId (undefined if not found) */
  getUnitVariant(unitId: UnitId): UnitType | undefined {
    return this.findVariantKey(unitId) || undefined
  }

  /** Get participating unit types from SETTINGS */
  getParticipatingUnitTypes(combatModeOverride?: CombatMode): UnitBaseType[] {
    const state = this.stateData
    const settings = this.getLiveParams('SETTINGS')
    const mode = combatModeOverride ?? state.combatMode
    if (!settings) {
      const sideState = this.data
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

  /** Get all unit types (participating + structures) from SETTINGS */
  getAllUnitTypes(): UnitBaseType[] {
    return [...new Set(UNIT_TYPES)]
  }

  /** Get unit variant options (base types + declared subtypes).
   *  `include`/`exclude` entries accept `UnitType`:
   *   - a bare base type (e.g., `'CRUISER'`) matches the base type and every
   *     subtyped variant of it;
   *   - a subtyped variant (e.g., `'CRUISER:Viscount'`) matches variants of
   *     the same base type whose subtypes are a superset of the entry's
   *     subtypes.
   *  `excludeSubtypes` hides variants that contain any of the listed subtype
   *  names (unconditional — applies to every matching declaration).
   *  `excludeSubtypeSource` drops declarations whose `source` ability key is
   *  in the list before building variants. Use it when an ability wants to
   *  hide its own declarations from its UI while keeping equivalent
   *  declarations from other abilities visible (e.g. Ssruu wrapping Viscount). */
  getUnitVariants(filter?: {
    include?: UnitType[]
    exclude?: UnitType[]
    excludeSubtypes?: string[]
    excludeSubtypeSource?: string[]
    includeSubtypes?: string[]
    combatMode?: CombatMode
    includeNonParticipating?: boolean
  }): UnitType[] {
    const baseTypes = filter?.includeNonParticipating
      ? this.getAllUnitTypes()
      : this.getParticipatingUnitTypes(filter?.combatMode)
    const settings = this.getLiveParams('SETTINGS')
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
        return !subtypes.some(s => excludeSubtypeSet.has(s))
      })
    }
    if (includeSubtypeSet) {
      filtered = filtered.filter(v => {
        const { subtypes } = parseVariantId(v)
        return subtypes.some(s => includeSubtypeSet.has(s))
      })
    }
    return filtered
  }

  /** Get unit variant options as {label, value} pairs */
  getUnitVariantOptions(filter?: {
    include?: UnitType[]
    exclude?: UnitType[]
    excludeSubtypes?: string[]
    excludeSubtypeSource?: string[]
    includeSubtypes?: string[]
    combatMode?: CombatMode
    includeNonParticipating?: boolean
  }): { label: string; value: UnitType }[] {
    return this.getUnitVariants(filter).map(id => ({
      label: getVariantDisplayName(id),
      value: id,
    }))
  }

  /** Resolve valid targets from SETTINGS for the given meta. */
  getSettingsValidTargets(meta: MetaPhase): UnitBaseType[] {
    const settings = this.getLiveParams('SETTINGS')
    if (!settings) return []
    return getSettingsValidTargetsUtil(settings, meta)
  }

  /** Get hit pool valid targets (falls back to settings valid targets) */
  getHitPoolValidTargets(meta: MetaPhase): UnitType[] {
    const pool = this.data.hitPools[0]
    if (pool && pool.validTargets && pool.validTargets.length > 0)
      return pool.validTargets
    return this.getSettingsValidTargets(meta)
  }

  // ==========================================================================
  // EXISTING QUERY METHODS (from original CombatSideState)
  // ==========================================================================

  /** Get participating units from SETTINGS ability. Hot path — called
   *  millions of times via `hasParticipatingUnits`, so inline the merge. */
  getParticipatingUnits(): ReadonlySet<UnitBaseType> {
    const state = this.stateData
    const side = this._side
    const liveSettings = state.liveAbilities[side]['SETTINGS']
    const baseSettings = state.abilities[side]['SETTINGS']
    const settings =
      liveSettings === undefined
        ? baseSettings
        : baseSettings === undefined
          ? liveSettings
          : { ...baseSettings, ...liveSettings }

    if (!settings) {
      throw new Error('No SETTINGS in getParticipatingUnits')
    }

    const units =
      state.combatMode === 'GROUND'
        ? (settings.groundCombatParticipating as UnitBaseType[])
        : (settings.spaceCombatParticipating as UnitBaseType[])

    return getParticipatingUnitsSet(units)
  }

  /** True if the side still holds any unit whose base type participates in the
   *  current combat mode. Non-participants (e.g., PDS in ground combat,
   *  infantry in space combat) don't count. */
  hasParticipatingUnits(): boolean {
    const participating = this.getParticipatingUnits()
    const { units } = this.data
    for (const key of Object.keys(units)) {
      if (units[key as UnitType].length <= 0) continue
      if (participating.has(parseVariantId(key as UnitType).type)) return true
    }
    return false
  }

  /** Get valid targets from SETTINGS for the given meta. */
  getValidTargetsForPhase(meta: MetaPhase): UnitBaseType[] {
    const settings = this.getLiveParams('SETTINGS')

    if (!settings) {
      throw new Error('No SETTINGS in getValidTargetsForPhase')
    }

    return getSettingsValidTargetsUtil(settings, meta)
  }

  collectDice(
    source: HitSource,
    allowedUnitTypes?: ReadonlySet<UnitBaseType>,
  ): DicePool {
    const participatingUnits = this.getParticipatingUnits()
    const result: DicePool = {}
    const data = this.data
    const { units } = data

    const skipParticipatingFilter =
      source === 'SPACE_CANNON' || source === 'BOMBARDMENT'

    // Track which base types had restrictions checked
    const restrictionChecked = new Map<UnitBaseType, boolean>()

    for (const key of Object.keys(units)) {
      const ids = units[key]
      if (ids.length <= 0) continue

      const { type } = parseVariantId(key)
      if (allowedUnitTypes && !allowedUnitTypes.has(type)) continue
      if (!skipParticipatingFilter && !participatingUnits.has(type)) continue

      // Check restrictions once per base type
      if (source !== 'COMBAT') {
        let allowed = restrictionChecked.get(type)
        if (allowed === undefined) {
          allowed = !(
            this.isRestricted('lost', source, type) ||
            this.isRestricted('cannotBeUsed', source, type)
          )
          restrictionChecked.set(type, allowed)
        }
        if (!allowed) continue
      }

      // Read dice values directly from shared stats
      const stats = resolveUnitStats(data.unitStats, key)
      if (!stats) continue
      const dieData =
        source === 'COMBAT' ? stats.COMBAT : stats.UNIT_ABILITIES?.[source]
      if (!dieData) continue
      const [hitValue, dicePerUnit, bonusDice = 0] = dieData
      if (dicePerUnit + bonusDice <= 0) continue

      // Store UnitId directly per unit
      const arr = result[type] ?? []
      for (const id of ids) {
        arr.push([hitValue, dicePerUnit, bonusDice, id])
      }
      result[type] = arr
    }

    return result
  }

  /** Assign hits to this side. Replaces sideData.units with a new record
   *  (does NOT mutate the original arrays — safe for shared branch data).
   *  Returns destroyed UnitIds record.
   *  When trackDestroyed is false, skips building the destroyed record. */
  assignHits(
    stateData: CombatStateData,
    meta: MetaPhase,
    trackDestroyed?: boolean,
  ): Record<string, UnitId[]> {
    const params = getAssignHitsParams(stateData, this._side, meta)
    return assignHitsForSide(stateData[this._side], params, trackDestroyed)
  }

  /** Simulate resolving a single HitPool against this side's current units.
   *  Returns the UnitIds that would be destroyed, in sacrifice order.
   *  Non-destructive — does not mutate state. */
  getAssignHitsTargets(hitPool: HitPool, meta: MetaPhase): UnitId[] {
    const params = getAssignHitsParams(this.stateData, this._side, meta)
    return getAssignHitsTargets(this.data, params, hitPool)
  }

  // ==========================================================================
  // MUTATION METHODS
  // ==========================================================================

  /** Remove one or more units by UnitId, UnitId[], or base type (first found).
   *  Removals are applied sequentially; for a UnitId[] variant, each ID is
   *  located against the current state after any preceding removals. */
  removeUnits(target: UnitBaseType | UnitId | UnitId[]): void {
    if (Array.isArray(target)) {
      for (const id of target) this._removeOne(id)
      return
    }
    this._removeOne(target)
  }

  private _removeOne(unitTypeOrUnit: UnitBaseType | UnitId): void {
    let unitId: UnitId
    let key: UnitType
    const data = this.data

    if (typeof unitTypeOrUnit === 'string') {
      const found = this.findFirstUnitId(unitTypeOrUnit)
      if (!found) return
      unitId = found.unitId
      key = found.key
    } else {
      unitId = unitTypeOrUnit
      const found = this.findVariantKey(unitId)
      if (!found) return
      key = found
    }

    const ids = data.units[key]
    const idx = ids.indexOf(unitId)
    if (idx === -1) return

    // Build a new array instead of splicing in-place so that branches
    // sharing the same units reference are not affected.
    if (ids.length <= 1) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _removed, ...rest } = data.units
      data.units = rest as SideStateData['units']
    } else {
      const copy = ids.slice()
      copy.splice(idx, 1)
      data.units = { ...data.units, [key]: copy }
    }

    delete data.unitState[unitId]
  }

  /** Modify per-unit mutable state */
  modifyUnitState(unitId: UnitId, updates: Partial<UnitState>): void {
    const data = this.data
    data.unitState[unitId] ??= {}
    Object.assign(data.unitState[unitId], updates)
  }

  /** Reduce pending hits from hit pools (reduces bonus first, then base) */
  reduceHits(amount: number): void {
    const data = this.data
    if (data.hitPools.length === 0 || amount <= 0) return
    let remaining = amount
    for (const pool of data.hitPools) {
      const total = pool.hits[0] + pool.hits[1]
      const reduce = Math.min(remaining, total)
      const bonusReduce = Math.min(reduce, pool.hits[1])
      const baseReduce = reduce - bonusReduce
      pool.hits = [pool.hits[0] - baseReduce, pool.hits[1] - bonusReduce]
      remaining -= reduce
      if (remaining <= 0) break
    }
  }

  /** Add a hit pool (ability-produced hits go into bonus slot) */
  addHits(hits: number, validTargets: UnitType[]): void {
    if (hits === 0) return
    this.data.hitPools.push({ hits: [0, hits], validTargets })
  }

  /** Move a unit to a new variant with an added subtype */
  addSubtype(
    variantId: UnitType,
    subtype: UnitVariantId,
    statsFactory?: (parentStats: UnitStats) => UnitStats,
  ): void {
    const data = this.data
    const { type, subtypes: currentSubtypes } = parseVariantId(variantId)

    let sourceKey: UnitType = variantId
    if (!data.units[sourceKey] || data.units[sourceKey].length <= 0) {
      sourceKey = type
    }
    if (!data.units[sourceKey] || data.units[sourceKey].length <= 0) return

    const newSubtypes = [...currentSubtypes, subtype].sort()
    const newKey = makeVariantId(type, newSubtypes as UnitVariantId[])
    if (newKey === sourceKey) return

    this._moveUnitVariant(sourceKey, newKey)

    if (!data.unitStats[newKey]) {
      let value: UnitStats | ((parentStats: UnitStats) => UnitStats) | undefined
      if (statsFactory) {
        value = statsFactory
      } else {
        const sourceStats =
          resolveUnitStats(data.unitStats, sourceKey) ??
          resolveUnitStats(data.unitStats, type)
        if (sourceStats) value = { ...sourceStats }
      }
      if (value !== undefined) {
        data.unitStats = { ...data.unitStats, [newKey]: value }
      }
    }
  }

  /** Move a unit to a variant with a subtype removed */
  removeSubtype(variantId: UnitType, subtype: UnitVariantId): void {
    const data = this.data
    const { type, subtypes: requiredSubtypes } = parseVariantId(variantId)

    let sourceKey: UnitType | undefined
    for (const key of Object.keys(data.units) as UnitType[]) {
      if (data.units[key].length <= 0) continue
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

    this._moveUnitVariant(sourceKey, newKey)
  }

  /** COW-safe move of one unit from sourceKey to newKey.
   *  Rebuilds `data.units` and affected arrays without mutating shared refs —
   *  safe to call inside branches that share arrays with the base state. */
  private _moveUnitVariant(sourceKey: UnitType, newKey: UnitType): void {
    const data = this.data
    const source = data.units[sourceKey]
    const movedId = source[source.length - 1]
    const units = { ...data.units }

    const newSource = source.slice(0, -1)
    if (newSource.length === 0) {
      delete units[sourceKey]
    } else {
      units[sourceKey] = newSource
    }

    const existing = units[newKey]
    units[newKey] = existing ? [...existing, movedId] : [movedId]

    data.units = units
  }

  /**
   * Modify stats for a unit type (pure state mutation).
   * Returns variant keys that had ABILITIES changes (for engine to queue invokes).
   */
  modifyUnitType(
    key: UnitType,
    updates: Partial<UnitStats>,
  ): { keysWithAbilitiesChange: { key: UnitType; ids: UnitId[] }[] } {
    const data = this.data
    const { type } = parseVariantId(key)
    const isVariantKey = key.includes(':')
    const keysWithAbilitiesChange: { key: UnitType; ids: UnitId[] }[] = []
    const hasAbilitiesUpdate = 'ABILITIES' in updates

    if (isVariantKey) {
      if (data.unitStats[key]) {
        if (typeof data.unitStats[key] === 'function') {
          data.unitStats[key] = resolveUnitStats(data.unitStats, key)!
        }
        Object.assign(data.unitStats[key], updates)
      }
      const ids = data.units[key]
      if (hasAbilitiesUpdate && ids?.length > 0) {
        keysWithAbilitiesChange.push({ key, ids })
      }
    } else {
      for (const vKey of Object.keys(data.units) as UnitType[]) {
        const { type: vType } = parseVariantId(vKey)
        if (vType !== type) continue
        if (data.unitStats[vKey]) {
          if (typeof data.unitStats[vKey] === 'function') {
            // Skip factory-based variants — they resolve against parent stats,
            // so updating the base type is sufficient.
            continue
          }
          Object.assign(data.unitStats[vKey], updates)
        }
        const ids = data.units[vKey]
        if (hasAbilitiesUpdate && ids?.length > 0) {
          keysWithAbilitiesChange.push({ key: vKey, ids })
        }
      }
      if (data.unitStats[type]) {
        if (typeof data.unitStats[type] === 'function') {
          data.unitStats[type] = resolveUnitStats(data.unitStats, type)!
        }
        Object.assign(data.unitStats[type], updates)
      }
    }

    return { keysWithAbilitiesChange }
  }

  /**
   * Place new units (pure state mutation).
   * Returns new UnitIds per type (for engine to queue invokes).
   */
  placeUnits(
    unitsToAdd: Partial<Record<UnitBaseType, number>>,
  ): Record<UnitType, UnitId[]> {
    const data = this.data
    const placed: Record<UnitType, UnitId[]> = {} as Record<UnitType, UnitId[]>

    for (const [type, count] of Object.entries(unitsToAdd)) {
      const unitType = type as UnitBaseType
      if (!count || count <= 0) continue
      const existing = totalCountForType(data.units, unitType)
      const limit = UNIT_LIMITS[unitType]
      if (existing + count > limit) {
        console.warn(
          `Unit limit exceeded: ${unitType} has a maximum of ${limit}`,
        )
      }
      const allowed = Math.min(count, limit - existing)
      if (allowed <= 0) continue

      const newIds = nextUnitIds(allowed)
      // Build a new array instead of pushing in-place so that branches
      // sharing the same units reference are not affected.
      const existing_ids = data.units[unitType]
      data.units = {
        ...data.units,
        [unitType]: existing_ids ? [...existing_ids, ...newIds] : [...newIds],
      }
      if (!data.unitStats[unitType]) {
        data.unitStats[unitType] = {}
      }

      placed[unitType] = newIds
    }

    return placed
  }

  /** Add a hit-value modifier to the pending dice-roll group for `meta`.
   *  The modifier rides on the group's `DiceRollContext` and is discarded
   *  when the group drains, so no explicit clearing is needed. */
  addHitValueModifier(amount: number, target: unknown, meta: MetaPhase): void {
    const group = findPendingDiceRollGroup(this._combatState.pendingSteps, meta)
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
    const list = (ctx.hitValueModifiers[this._side] ??= [])
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

  /** Add a restriction */
  addRestriction(
    layer: 'lost' | 'cannotBeUsed',
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ): void {
    const data = this.data
    const isCategory = target !== undefined && target in UNIT_CATEGORIES
    data.unitAbilityRestrictions = addRestrictionEntry(
      data.unitAbilityRestrictions,
      layer,
      ability,
      reason,
      isCategory ? undefined : (target as UnitBaseType),
      isCategory ? (target as UnitCategory) : undefined,
    )
  }

  /** Remove a restriction */
  removeRestriction(
    layer: 'lost' | 'cannotBeUsed',
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ): void {
    const data = this.data
    const isCategory = target !== undefined && target in UNIT_CATEGORIES
    data.unitAbilityRestrictions = removeRestrictionEntry(
      data.unitAbilityRestrictions,
      layer,
      ability,
      reason,
      isCategory ? undefined : (target as UnitBaseType),
      isCategory ? (target as UnitCategory) : undefined,
    )
  }
}
