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

/** Shared empty destroyed record to avoid per-call {} allocation */
const EMPTY_DESTROYED: Record<string, UnitId[]> = {}

/** True when `validTargets` restricts which variants a HitPool can kill.
 *  An empty or missing list means "no restriction" (the fast path). */
function hasValidTargets(hitPool: HitPool): boolean {
  return hitPool.validTargets !== undefined && hitPool.validTargets.length > 0
}

/** Whether `unitType[id]` satisfies the pool's `validTargets`. Matches both
 *  exact variant keys (e.g. `'CRUISER:Cavalry'`) and the bare base type
 *  (`'CRUISER'`) — mirroring how dice-pool eligibility works elsewhere. */
function matchesValidTargets(
  sideData: SideStateData,
  id: UnitId,
  validTargets: readonly UnitType[],
): boolean {
  const key = sideData.unitType[id]
  if (!key) return false
  if (validTargets.includes(key)) return true
  const baseType = parseVariantId(key).type as UnitType
  return validTargets.includes(baseType)
}

/** Pick destruction targets from `pool` for a single HitPool.
 *
 *  Fast path (no `validTargets`): tail slice of `pool`.
 *  Slow path (`validTargets` set, used by unit abilities): walk
 *  `priorityList` in order (first entry = first to die). For each
 *  variant that is in `validTargets`, pick matching ids from `pool`'s
 *  tail. Fall back to tail-walk when no priority list is supplied.
 *
 *  Returns the chosen ids in destruction order (earliest-to-die first). */
function pickTargetsForPool(
  sideData: SideStateData,
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
    // Use priorityList order: first entry is first to die.
    // `validTargets` acts as a filter on top.
    const targetSet = new Set<UnitType>(targets)
    for (const variantKey of priorityList) {
      if (result.length >= total) break
      if (!targetSet.has(variantKey)) {
        const baseType = parseVariantId(variantKey).type as UnitType
        if (!targetSet.has(baseType)) continue
      }
      // Walk `pool` from tail and pick ids whose variant matches.
      for (let i = pool.length - 1; i >= 0 && result.length < total; i--) {
        const id = pool[i]
        if (sideData.unitType[id] !== variantKey) continue
        if (result.includes(id)) continue
        result.push(id)
      }
    }
    if (result.length >= total) return result
  }

  // Fallback (no priority list, or priority didn't fill the quota):
  // tail-walk by the array's existing sort.
  for (let i = pool.length - 1; i >= 0 && result.length < total; i--) {
    const id = pool[i]
    if (result.includes(id)) continue
    if (matchesValidTargets(sideData, id, targets)) result.push(id)
  }
  return result
}

/** Returns the UnitIds that would be destroyed if the given HitPool were
 *  resolved now against this side's participating units. Non-destructive. */
export function getAssignHitsTargets(
  sideData: SideStateData,
  hitPool: HitPool,
  priorityList?: readonly UnitType[],
): UnitId[] {
  return pickTargetsForPool(
    sideData,
    sideData.participatingUnits,
    hitPool,
    priorityList,
  )
}

/** Standalone hit assignment — fast tail-slice when no `validTargets`,
 *  full traversal when they are set. Mutates only `participatingUnits`.
 *  CoW-safe: replaces `sideData.participatingUnits` with a fresh array;
 *  the old reference (shared with sibling branches) is untouched. */
export function assignHitsForSide(
  sideData: SideStateData,
  trackDestroyed?: boolean,
  priorityList?: readonly UnitType[],
): Record<string, UnitId[]> {
  if (sideData.hitPools.length === 0) return EMPTY_DESTROYED

  const allFast = sideData.hitPools.every(p => !hasValidTargets(p))
  let total = 0
  for (const pool of sideData.hitPools) {
    total += pool.hits[0] + pool.hits[1]
  }
  if (total === 0) {
    sideData.hitPools = []
    return EMPTY_DESTROYED
  }

  const oldUnits = sideData.participatingUnits
  const destroyedIds: UnitId[] = []

  if (allFast) {
    const take = Math.min(total, oldUnits.length)
    const kept = oldUnits.length - take
    sideData.participatingUnits = oldUnits.slice(0, kept)
    if (trackDestroyed) {
      for (let i = kept; i < oldUnits.length; i++)
        destroyedIds.push(oldUnits[i])
    }
  } else {
    // Resolve each pool with slow-path targeting (respects validTargets
    // and per-phase priority). Splice picks out of a shared working copy.
    const working = oldUnits.slice()
    for (const pool of sideData.hitPools) {
      const picks = pickTargetsForPool(sideData, working, pool, priorityList)
      for (const id of picks) {
        const idx = working.indexOf(id)
        if (idx === -1) continue
        working.splice(idx, 1)
        if (trackDestroyed) destroyedIds.push(id)
      }
    }
    sideData.participatingUnits = working
  }

  sideData.hitPools = []

  if (!trackDestroyed) return EMPTY_DESTROYED

  const destroyed: Record<string, UnitId[]> = {}
  for (const id of destroyedIds) {
    const key = sideData.unitType[id]
    ;(destroyed[key] ??= []).push(id)
  }
  return destroyed
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

  /** Participating units (pre-sorted, hot path). Use `allUnits` when the
   *  caller also needs to see non-participating units. */
  get units() {
    return this.data.participatingUnits
  }

  get participatingUnits() {
    return this.data.participatingUnits
  }

  get nonParticipatingUnits() {
    return this.data.nonParticipatingUnits
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

  /** Find variant key for a UnitId (empty string if not tracked). */
  findVariantKey(unitId: UnitId): UnitType | '' {
    return this.data.unitType[unitId] ?? ''
  }

  /** Find the first (highest-priority) alive UnitId for a base type.
   *  Participating units are scanned first (they're priority-sorted);
   *  non-participating are the fallback. */
  findFirstUnitId(
    baseType: UnitBaseType,
  ): { unitId: UnitId; key: UnitType } | undefined {
    const { participatingUnits, nonParticipatingUnits, unitType } = this.data
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

  /** Find first unit matching a caller-supplied priority list.
   *  Walks `priority` in order; for each variant, scans `units[]` for matching
   *  alive ids. Caller's priority overrides the array's sort order. */
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
    const { participatingUnits, nonParticipatingUnits, unitType } = this.data
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
  countUnits(
    filter?: UnitType | UnitType[],
    includeVariants?: boolean,
  ): number {
    const { participatingUnits, nonParticipatingUnits, unitType } = this.data
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

  /** Get all UnitIds for a type, optionally including variants.
   *  Participating ids are returned first (in priority-sort order). */
  getUnits(unitType: UnitType, includeVariants?: boolean): UnitId[] {
    const {
      participatingUnits,
      nonParticipatingUnits,
      unitType: typeMap,
    } = this.data
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

  /** Check if a specific UnitId is alive on this side. */
  hasUnit(unitId: UnitId): boolean {
    return (
      this.data.participatingUnits.includes(unitId) ||
      this.data.nonParticipatingUnits.includes(unitId)
    )
  }

  /** Check if a unit type has any alive units. */
  hasUnitType(unitType: UnitType, includeVariants?: boolean): boolean {
    const {
      participatingUnits,
      nonParticipatingUnits,
      unitType: typeMap,
    } = this.data
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

  /** Get all active base types (types with at least one alive unit). */
  getActiveBaseTypes(): UnitBaseType[] {
    const { participatingUnits, nonParticipatingUnits, unitType } = this.data
    const types = new Set<UnitBaseType>()
    for (const id of participatingUnits) {
      types.add(parseVariantId(unitType[id]).type as UnitBaseType)
    }
    for (const id of nonParticipatingUnits) {
      types.add(parseVariantId(unitType[id]).type as UnitBaseType)
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

  /** Get UnitState for a UnitId. */
  getUnitState(unitId: UnitId): UnitState | undefined {
    if (!this.hasUnit(unitId)) return undefined
    return this.data.unitState[unitId] ?? {}
  }

  /** Get base type for a UnitId. */
  getUnitBaseType(unitId: UnitId): UnitBaseType | undefined {
    const key = this.data.unitType[unitId]
    if (!key) return undefined
    return parseVariantId(key).type as UnitBaseType
  }

  /** Get variant key for a UnitId (undefined if not tracked). */
  getUnitVariant(unitId: UnitId): UnitType | undefined {
    return this.data.unitType[unitId]
  }

  /** Get participating unit types from SETTINGS. */
  getParticipatingUnitTypes(combatModeOverride?: CombatMode): UnitBaseType[] {
    const state = this.stateData
    const settings = this.getLiveParams('SETTINGS')
    const mode = combatModeOverride ?? state.combatMode
    if (!settings) {
      // Fallback: derive from alive participating units.
      const { participatingUnits, unitType } = this.data
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

    return new Set(units)
  }

  /** True if the side still holds any participating unit. */
  hasParticipatingUnits(): boolean {
    return this.data.participatingUnits.length > 0
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
    const participatingTypes = this.getParticipatingUnits()
    const result: DicePool = {}
    const data = this.data

    // SPACE_CANNON / BOMBARDMENT can be contributed by non-participating
    // units too (e.g. ships bombarding during ground combat, PDS firing
    // from structures in space combat). Other sources are participating-only.
    const scanNonParticipating =
      source === 'SPACE_CANNON' || source === 'BOMBARDMENT'

    // Cache per-variant stats lookup + per-base-type restriction check across
    // the single walk.
    const variantStatsCache = new Map<
      UnitType,
      readonly [number, number, number] | null
    >()
    const restrictionChecked = new Map<UnitBaseType, boolean>()

    const walk = (pool: UnitId[], skipParticipatingCheck: boolean) => {
      for (const id of pool) {
        const key = data.unitType[id]
        const { type } = parseVariantId(key)

        if (allowedUnitTypes && !allowedUnitTypes.has(type)) continue
        if (!skipParticipatingCheck && !participatingTypes.has(type)) continue

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

        let die = variantStatsCache.get(key)
        if (die === undefined) {
          const stats = resolveUnitStats(data.unitStats, key)
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

    // Participating pool is the hot path; its membership check is
    // already satisfied by the array.
    walk(data.participatingUnits, true)
    if (scanNonParticipating) {
      // Non-participating pool — let the participatingTypes check run,
      // since these ids are by definition not in the participating set
      // but may still be valid sources (bombardment ships, PDS).
      walk(data.nonParticipatingUnits, true)
    }

    return result
  }

  /** Assign hits to this side. Replaces sideData.units with a new array
   *  (does NOT mutate the original — safe for shared branch data).
   *  Returns destroyed UnitIds grouped by variant key. */
  assignHits(
    _stateData: CombatStateData,
    _meta: MetaPhase,
    trackDestroyed?: boolean,
  ): Record<string, UnitId[]> {
    return assignHitsForSide(this.data, trackDestroyed)
  }

  /** Simulate resolving a single HitPool against this side's current units.
   *  Returns the UnitIds that would be destroyed, in sacrifice order (tail first). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAssignHitsTargets(hitPool: HitPool, _meta: MetaPhase): UnitId[] {
    return getAssignHitsTargets(this.data, hitPool)
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
    const data = this.data
    let unitId: UnitId

    if (typeof unitTypeOrUnit === 'string') {
      // Find first (highest-priority) alive unit of that base type.
      const found = this.findFirstUnitId(unitTypeOrUnit)
      if (!found) return
      unitId = found.unitId
    } else {
      unitId = unitTypeOrUnit
    }

    // CoW: rebuild whichever array holds the id.
    const pIdx = data.participatingUnits.indexOf(unitId)
    if (pIdx !== -1) {
      const copy = data.participatingUnits.slice()
      copy.splice(pIdx, 1)
      data.participatingUnits = copy
    } else {
      const nIdx = data.nonParticipatingUnits.indexOf(unitId)
      if (nIdx === -1) return
      const copy = data.nonParticipatingUnits.slice()
      copy.splice(nIdx, 1)
      data.nonParticipatingUnits = copy
    }

    delete data.unitState[unitId]
    // unitType[unitId] is intentionally left in place.
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

  /** Move one unit to a new variant with an added subtype.
   *  Iteration 1: updates unitType[id] only. Array position is unchanged,
   *  so the unit keeps its current sort rank even if the new variant has a
   *  different priority. (Deferred — see spec "Out of scope".) */
  addSubtype(
    variantId: UnitType,
    subtype: UnitVariantId,
    statsFactory?: (parentStats: UnitStats) => UnitStats,
  ): void {
    const data = this.data
    const { type, subtypes: currentSubtypes } = parseVariantId(variantId)

    // Prefer a unit whose current variant matches `variantId` exactly.
    // Fall back to any unit with the same base type.
    const pickFrom = (
      pool: UnitId[],
      matchExact: boolean,
    ): UnitId | undefined => {
      for (let i = pool.length - 1; i >= 0; i--) {
        const id = pool[i]
        const key = data.unitType[id]
        if (matchExact ? key === variantId : parseVariantId(key).type === type)
          return id
      }
      return undefined
    }
    const pickedId =
      pickFrom(data.participatingUnits, true) ??
      pickFrom(data.nonParticipatingUnits, true) ??
      pickFrom(data.participatingUnits, false) ??
      pickFrom(data.nonParticipatingUnits, false)
    if (pickedId === undefined) return

    const sourceKey = data.unitType[pickedId]
    const newSubtypes = [...currentSubtypes, subtype].sort()
    const newKey = makeVariantId(type, newSubtypes as UnitVariantId[])
    if (newKey === sourceKey) return

    // CoW unitType: fresh record with the updated entry.
    data.unitType = { ...data.unitType, [pickedId]: newKey }

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

  /** Move one unit to a variant with a subtype removed.
   *  Iteration 1: updates unitType[id] only; array position unchanged. */
  removeSubtype(variantId: UnitType, subtype: UnitVariantId): void {
    const data = this.data
    const { type, subtypes: requiredSubtypes } = parseVariantId(variantId)

    const findIn = (pool: UnitId[]): UnitId | undefined => {
      for (let i = pool.length - 1; i >= 0; i--) {
        const id = pool[i]
        const key = data.unitType[id]
        const { type: kType, subtypes: kSubs } = parseVariantId(key)
        if (kType !== type) continue
        if (!kSubs.includes(subtype as UnitVariantId)) continue
        if (requiredSubtypes.every(s => kSubs.includes(s))) return id
      }
      return undefined
    }
    const pickedId =
      findIn(data.participatingUnits) ?? findIn(data.nonParticipatingUnits)
    if (pickedId === undefined) return

    const sourceKey = data.unitType[pickedId]
    const { subtypes: sourceSubs } = parseVariantId(sourceKey)
    const newSubtypes = sourceSubs.filter(s => s !== subtype)
    const newKey: UnitType =
      newSubtypes.length > 0 ? makeVariantId(type, newSubtypes) : type

    if (newKey === sourceKey) return

    data.unitType = { ...data.unitType, [pickedId]: newKey }
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
    const hasAbilitiesUpdate = 'ABILITIES' in updates

    if (isVariantKey) {
      if (data.unitStats[key]) {
        if (typeof data.unitStats[key] === 'function') {
          data.unitStats[key] = resolveUnitStats(data.unitStats, key)!
        }
        Object.assign(data.unitStats[key], updates)
      }
    } else {
      for (const vKey of Object.keys(data.unitStats) as UnitType[]) {
        const { type: vType } = parseVariantId(vKey)
        if (vType !== type) continue
        if (!data.unitStats[vKey]) continue
        if (typeof data.unitStats[vKey] === 'function') {
          // Skip factory variants — they resolve against parent stats.
          continue
        }
        Object.assign(data.unitStats[vKey], updates)
      }
    }

    if (!hasAbilitiesUpdate) return { keysWithAbilitiesChange: [] }

    // Bucket alive units by variant key, filtered to the updated key(s).
    const buckets = new Map<UnitType, UnitId[]>()
    const bucketize = (pool: UnitId[]) => {
      for (const id of pool) {
        const vKey = data.unitType[id]
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
    bucketize(data.participatingUnits)
    bucketize(data.nonParticipatingUnits)

    const keysWithAbilitiesChange: { key: UnitType; ids: UnitId[] }[] = []
    for (const [k, ids] of buckets)
      keysWithAbilitiesChange.push({ key: k, ids })
    return { keysWithAbilitiesChange }
  }

  /** Place new units (pure state mutation).
   *  Iteration 1: new UnitIds are appended to the end of whichever pool
   *  matches the base type's participating status. They land at the
   *  lowest-priority end regardless of actual priority rank. Deferred. */
  placeUnits(
    unitsToAdd: Partial<Record<UnitBaseType, number>>,
  ): Record<UnitType, UnitId[]> {
    const data = this.data
    const placed: Record<UnitType, UnitId[]> = {} as Record<UnitType, UnitId[]>
    const participatingTypes = new Set(this.getParticipatingUnitTypes())

    let nextPart = data.participatingUnits
    let nextNon = data.nonParticipatingUnits
    let nextUnitType = data.unitType

    for (const [type, count] of Object.entries(unitsToAdd)) {
      const unitType_ = type as UnitBaseType
      if (!count || count <= 0) continue

      // Count existing alive units of this base type across both pools.
      let existing = 0
      for (const id of data.participatingUnits) {
        if (parseVariantId(data.unitType[id]).type === unitType_) existing++
      }
      for (const id of data.nonParticipatingUnits) {
        if (parseVariantId(data.unitType[id]).type === unitType_) existing++
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
      // CoW: fresh arrays/records every append.
      if (participatingTypes.has(unitType_)) {
        nextPart = [...nextPart, ...newIds]
      } else {
        nextNon = [...nextNon, ...newIds]
      }
      const typeMapAdditions: Record<UnitId, UnitType> = {}
      for (const id of newIds) typeMapAdditions[id] = unitType_
      nextUnitType = { ...nextUnitType, ...typeMapAdditions }

      if (!data.unitStats[unitType_]) {
        data.unitStats[unitType_] = {}
      }

      placed[unitType_] = newIds
    }

    data.participatingUnits = nextPart
    data.nonParticipatingUnits = nextNon
    data.unitType = nextUnitType

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
