import type { UnitCategory } from '@/constants/units'
import { UNIT_CATEGORIES, UNIT_LIMITS, UNIT_TYPES } from '@/constants/units'
import type {
  CombatSide,
  UnitAbility,
  UnitBaseType,
  UnitId,
  UnitIdList,
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
  ResolvedRestrictions,
  ResolvedRestrictionsLayer,
  RestrictionEntry,
  SideAbilitiesConfig,
  SideStateData,
  UnitAbilityRestrictions,
} from '../combat-state/types'
import { isDiceRollContext } from '../combat-state/types'
import { canonicalizeUnitState } from '../utils/canonicalize-unit-state'
import { resolveUnitStats } from '../utils/resolve-unit-stats'
import { nextUnitIds } from '../utils/unit-id'
import {
  getVariantDisplayName,
  makeVariantId,
  matchesVariantSuperset,
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

/** Merge an ability's base config with its live-overlay config. */
function mergeConfig(
  s: SideStateData,
  key: string,
): Record<string, unknown> | undefined {
  const base = s.abilities[key]
  const live = s.liveAbilities[key]
  if (base === undefined && live === undefined) return undefined
  if (live === undefined) return base
  if (base === undefined) return live
  return { ...base, ...live }
}

/** Parse a UnitList (flat or `[type, enabled]` tuples) into a UnitType[]. */
function parsePriorityList(raw: unknown): UnitType[] | undefined {
  if (!Array.isArray(raw)) return undefined
  if (raw.length === 0) return raw as UnitType[]
  if (!Array.isArray(raw[0])) return raw as UnitType[]
  const result: UnitType[] = []
  for (const entry of raw as readonly [string, ...unknown[]][]) {
    if (entry.length >= 2 && entry[1] === false) continue
    result.push(entry[0] as UnitType)
  }
  return result
}

/** CoW — clone `unitState` if its ref may be shared with another side.
 *  Also clones the touched entry refs lazily via replace-semantics at
 *  the mutation site (see `modifyUnitState`). */
function ensureUnitStateOwned(s: SideStateData): void {
  if (s._unitStateShared) {
    s.unitState = { ...s.unitState }
    s._unitStateShared = false
  }
}

/** CoW — clone `hitPools` if its ref may be shared with another side.
 *  Pool objects inside are not deep-cloned: the branch flow guarantees
 *  that newly-added pools are branch-local, and pre-existing pools are
 *  replaced (not in-place mutated) in `reduceHits`. */
function ensureHitPoolsOwned(s: SideStateData): void {
  if (s._hitPoolsShared) {
    s.hitPools = s.hitPools.slice()
    s._hitPoolsShared = false
  }
}

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

/** Pick destruction targets from `pool` for a single HitPool. `pool`
 *  may be either a packed UnitId string (as stored on SideStateData) or
 *  an already-materialized array of UnitIds (the working copy used by
 *  the slow path in `assignHits`). */
function pickTargetsForPool(
  s: SideStateData,
  pool: UnitIdList | readonly UnitId[],
  hitPool: HitPool,
  priorityList?: readonly UnitType[],
): UnitId[] {
  const total = hitPool.hits[0] + hitPool.hits[1]
  if (total <= 0 || pool.length === 0) return []

  if (!hasValidTargets(hitPool)) {
    const take = Math.min(total, pool.length)
    const result: UnitId[] = []
    for (let i = pool.length - take; i < pool.length; i++) {
      result.push(pool[i] as UnitId)
    }
    return result
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
        const id = pool[i] as UnitId
        if (s.unitType[id] !== variantKey) continue
        if (result.includes(id)) continue
        result.push(id)
      }
    }
    if (result.length >= total) return result
  }

  for (let i = pool.length - 1; i >= 0 && result.length < total; i--) {
    const id = pool[i] as UnitId
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

/** Shared empty resolved cache used when a side has no restrictions. */
const EMPTY_RESOLVED: ResolvedRestrictions = {
  cannotBeUsed: new Map(),
  lost: new Map(),
}

/** Invalidate the resolved-restrictions cache on both sides. Cheap —
 *  just drops the refs. Cache is rebuilt lazily on the next `isRestricted`
 *  / `isAbilityBlocked` read. Must be called from any mutation that could
 *  affect a restriction outcome: raw entry add/remove (this side or the
 *  other, because cascades cross sides), unit composition changes (new
 *  variant keys), and SETTINGS live-param writes (category membership). */
function invalidateResolvedRestrictions(state: CombatStateData): void {
  state.attacker._resolvedRestrictions = undefined
  state.defender._resolvedRestrictions = undefined
}

/** Build the resolved-restrictions cache for one side. Runs the cascade
 *  check (`isSourceDisabled`) once per raw entry, expands category/base
 *  rules against the side's current variant keys, and caches a
 *  `Set<UnitType> | 'ALL'` per (layer, ability). Subsequent checks are
 *  Map.get + Set.has — O(1). */
function buildResolvedForSide(
  state: CombatStateData,
  side: CombatSide,
): ResolvedRestrictions {
  const s = state[side]
  const raw = s.unitAbilityRestrictions
  if (!raw) return EMPTY_RESOLVED

  const cannotBeUsed: ResolvedRestrictionsLayer = new Map()
  const lost: ResolvedRestrictionsLayer = new Map()

  // Unique variant keys currently on the side, needed to expand
  // base-type and category rules into concrete variant matches.
  const variantKeys = new Set<UnitType>()
  for (const key of Object.values(s.unitType)) variantKeys.add(key)

  const addToLayer = (
    target: ResolvedRestrictionsLayer,
    ability: UnitAbility,
    entry: RestrictionEntry,
  ) => {
    const existing = target.get(ability)
    if (existing === 'ALL') return

    if (!entry.unitType && !entry.category) {
      target.set(ability, 'ALL')
      return
    }

    const set = existing ?? new Set<UnitType>()

    if (entry.unitType) {
      set.add(entry.unitType as UnitType)
      // A bare baseType entry also restricts every variant of that type.
      for (const key of variantKeys) {
        if (parseVariantId(key).type === entry.unitType) set.add(key)
      }
    } else if (entry.category) {
      for (const key of variantKeys) {
        const baseType = parseVariantId(key).type
        if (isCategoryMember(s, entry.category, baseType)) {
          set.add(key)
          set.add(baseType as UnitType)
        }
      }
    }

    target.set(ability, set)
  }

  for (const layer of ['lost', 'cannotBeUsed'] as const) {
    const layerData = raw[layer]
    if (!layerData) continue
    const target = layer === 'lost' ? lost : cannotBeUsed
    for (const ability in layerData) {
      const entries = layerData[ability as UnitAbility]
      if (!entries) continue
      for (const entry of entries) {
        if (isSourceDisabled(state, entry.reason, new Set())) continue
        addToLayer(target, ability as UnitAbility, entry)
      }
    }
  }

  return { cannotBeUsed, lost }
}

/** Lazy accessor — returns the per-side resolved cache, building it on
 *  first read after invalidation. */
function getResolvedRestrictions(
  state: CombatStateData,
  side: CombatSide,
): ResolvedRestrictions {
  const cached = state[side]._resolvedRestrictions
  if (cached) return cached
  const built = buildResolvedForSide(state, side)
  state[side]._resolvedRestrictions = built
  return built
}

function _removeOne(
  s: SideStateData,
  unitTypeOrUnit: UnitBaseType | UnitId,
): void {
  let unitId: UnitId

  // UnitId is a single-char packed token; UnitBaseType is a multi-char
  // tag like "CRUISER". Distinguish by length rather than `typeof`.
  if (unitTypeOrUnit.length > 1) {
    const found = CombatSideState.findFirstUnitId(
      s,
      unitTypeOrUnit as UnitBaseType,
    )
    if (!found) return
    unitId = found.unitId
  } else {
    unitId = unitTypeOrUnit as UnitId
  }

  const pIdx = s.participatingUnits.indexOf(unitId)
  if (pIdx !== -1) {
    s.participatingUnits = (s.participatingUnits.slice(0, pIdx) +
      s.participatingUnits.slice(pIdx + 1)) as UnitIdList
  } else {
    const nIdx = s.nonParticipatingUnits.indexOf(unitId)
    if (nIdx === -1) return
    s.nonParticipatingUnits = (s.nonParticipatingUnits.slice(0, nIdx) +
      s.nonParticipatingUnits.slice(nIdx + 1)) as UnitIdList
  }
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

export interface GetUnitsOptions {
  includeVariants?: boolean
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
   *  per-unit mutable state) for state deduplication.
   *
   *  `unitState` is canonicalized: falsy field values are dropped (so
   *  `{ isDamaged: false }` is equivalent to no entry at all — important
   *  because CLEANUP_ROUND resets `usedSustainThisRound` to `false`
   *  rather than deleting it, and we don't want that residual to fork
   *  the cache from the never-touched starting state). Keys are sorted
   *  so the same truthy state hashes identically regardless of which
   *  ability happened to touch each unit first.
   *
   *  Phantom entries (a `unitState` key whose UnitId is no longer in
   *  `participatingUnits` or `nonParticipatingUnits`) are skipped —
   *  they belong to destroyed units and don't affect future combat.
   *
   *  Convergence across equivalent states ("A damaged" vs "B damaged")
   *  relies on `canonicalizeUnitState` having run. Natural sustain
   *  order keeps the bijection (lowest pool-ID ↔ worst state) stable;
   *  Duranium's WHEN_SUSTAIN and AFTER_ASSIGN repair both call
   *  `SideApi.resortUnits()` to mark `_needsCanonicalize`. The flush
   *  here catches state read at round-start (cache-key time), where
   *  the BEFORE_ASSIGN_HITS script step hasn't run yet. */
  static getUnitsHash(s: SideStateData): string {
    const dirty = s._needsCanonicalize
    if (dirty) {
      canonicalizeUnitState(s, dirty)
    }
    const ids = Object.keys(s.unitState).sort()
    let body = ''
    for (const id of ids) {
      const entry = s.unitState[id as UnitId]
      const inner = `isDamaged=${entry.isDamaged ?? false}`
      body += `${id}:${inner},`
    }
    return `${s.participatingUnits}!${s.nonParticipatingUnits}|${body}`
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
    options?: GetUnitsOptions,
  ): boolean {
    return CombatSideState.countUnits(s, unitType, options) > 0
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
      if (parseVariantId(key).type === baseType)
        return { unitId: id as UnitId, key }
    }
    for (const id of nonParticipatingUnits) {
      const key = unitType[id]
      if (parseVariantId(key).type === baseType)
        return { unitId: id as UnitId, key }
    }
    return undefined
  }

  /** Get all UnitIds for a type, optionally including variants.
   *  Participating ids are returned first (in priority-sort order). */
  static getUnits(
    s: SideStateData,
    unitType: UnitType,
    options?: GetUnitsOptions,
  ): UnitId[] {
    const { participatingUnits, nonParticipatingUnits, unitType: typeMap } = s
    const result: UnitId[] = []
    const matches = options?.includeVariants
      ? (key: UnitType) => matchesVariantSuperset(key, unitType)
      : (key: UnitType) => key === unitType
    for (const id of participatingUnits) {
      if (matches(typeMap[id])) result.push(id as UnitId)
    }
    for (const id of nonParticipatingUnits) {
      if (matches(typeMap[id])) result.push(id as UnitId)
    }
    return result
  }

  /** Count units with optional filter and variant support.
   *  Counts across both participating and non-participating pools. */
  static countUnits(
    s: SideStateData,
    filter?: UnitType | UnitType[],
    options?: GetUnitsOptions,
  ): number {
    if (!filter) {
      return s.participatingUnits.length + s.nonParticipatingUnits.length
    }
    const filters = typeof filter === 'string' ? [filter] : filter
    let total = 0
    for (const f of filters) {
      total += CombatSideState.getUnits(s, f, options).length
    }
    return total
  }

  static findUnitByPriority(
    s: SideStateData,
    priority: UnitType[],
    participatingTypes?: ReadonlySet<UnitBaseType>,
    options?: undefined,
  ): UnitId | undefined
  static findUnitByPriority(
    s: SideStateData,
    priority: UnitType[],
    participatingTypes: ReadonlySet<UnitBaseType> | undefined,
    options: GetUnitsOptions & { amount?: number },
  ): UnitId[]
  static findUnitByPriority(
    s: SideStateData,
    priority: UnitType[],
    participatingTypes?: ReadonlySet<UnitBaseType>,
    options?: GetUnitsOptions & { amount?: number },
  ): UnitId | UnitId[] | undefined {
    const collect = options !== undefined
    const amount = options?.amount ?? Infinity
    const result: UnitId[] = []

    for (const variantId of priority) {
      const { type } = parseVariantId(variantId)
      if (participatingTypes && !participatingTypes.has(type)) continue
      for (const id of CombatSideState.getUnits(s, variantId, options)) {
        if (!collect) return id
        result.push(id)
        if (result.length >= amount) return result
      }
    }
    return collect ? result : undefined
  }

  /** Get UnitState for a UnitId. */
  static getUnitState(s: SideStateData, unitId: UnitId): UnitState | undefined {
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
    // UnitId is a single-char packed token; any longer string is a variant key.
    if (unitTypeOrId.length > 1) {
      const stats = resolveUnitStats(s.unitStats, unitTypeOrId as UnitType)
      if (stats) return stats
      const { type } = parseVariantId(unitTypeOrId as UnitType)
      if (type !== unitTypeOrId) {
        return resolveUnitStats(s.unitStats, type)
      }
      return undefined
    }
    const key = CombatSideState.findVariantKey(s, unitTypeOrId as UnitId)
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
    if (meta === 'SPACE_CANNON_OFFENSE') {
      const sc = mergeConfig(s, 'RESOLVE_SPACE_CANNON')
      if (sc?.customScoPriority) {
        const parsed = parsePriorityList(sc.scoUnitPriority)
        if (parsed !== undefined) return parsed
      }
    }
    const unitPriority = mergeConfig(s, 'UNIT_PRIORITY')
    if (!unitPriority) return undefined
    const key = mode === 'GROUND' ? 'groundUnitPriority' : 'spaceUnitPriority'
    return parsePriorityList(unitPriority[key])
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
  static getHitPoolValidTargets(s: SideStateData): UnitType[] | undefined {
    const pool = s.hitPools[0]
    if (pool && pool.validTargets && pool.validTargets.length > 0)
      return pool.validTargets
    return undefined
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
      includeOnlyBaseTypes?: boolean
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
    let declaredSubtypes = excludedSources
      ? allDeclaredSubtypes.filter(
          d => d.source === undefined || !excludedSources.has(d.source),
        )
      : allDeclaredSubtypes
    if (!filter?.includeNonParticipating) {
      declaredSubtypes = declaredSubtypes.filter(d => d.participating !== false)
    }

    const baseSet = new Set<string>(baseTypes)
    const result: UnitType[] = [...baseTypes]
    const addedSet = new Set<string>(baseTypes)
    if (filter?.includeOnlyBaseTypes) {
      declaredSubtypes = []
    }
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
      includeOnlyBaseTypes?: boolean
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

  /** Check if a unit ability is restricted (variant-aware, category-aware).
   *  O(1) — reads the pre-resolved cache (lazy-built on first call after
   *  each restriction/unit/SETTINGS mutation). */
  static isRestricted(
    state: CombatStateData,
    side: CombatSide,
    layer: 'lost' | 'cannotBeUsed',
    ability: UnitAbility,
    unitType: string,
  ): boolean {
    if (!state[side].unitAbilityRestrictions) return false
    const resolved = getResolvedRestrictions(state, side)[layer].get(ability)
    if (!resolved) return false
    if (resolved === 'ALL') return true
    return resolved.has(unitType as UnitType)
  }

  /** Check if a unit ability is fully blocked by a blanket restriction.
   *  O(1) — reads the pre-resolved cache. */
  static isAbilityBlocked(
    state: CombatStateData,
    side: CombatSide,
    ability: UnitAbility,
  ): boolean {
    if (!state[side].unitAbilityRestrictions) return false
    const resolved = getResolvedRestrictions(state, side)
    return (
      resolved.lost.get(ability) === 'ALL' ||
      resolved.cannotBeUsed.get(ability) === 'ALL'
    )
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

    const walk = (pool: UnitIdList, skipParticipatingCheck: boolean) => {
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
        arr.push([hitValue, dicePerUnit, bonusDice, id as UnitId])
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
      s._hitPoolsShared = false
      return EMPTY_DESTROYED
    }

    const oldUnits = s.participatingUnits
    const destroyedIds: UnitId[] = []

    if (allFast) {
      const take = Math.min(total, oldUnits.length)
      const kept = oldUnits.length - take
      s.participatingUnits = oldUnits.slice(0, kept) as UnitIdList
      if (trackDestroyed) {
        for (let i = kept; i < oldUnits.length; i++)
          destroyedIds.push(oldUnits[i] as UnitId)
      }
    } else {
      const working = [...oldUnits] as UnitId[]
      for (const pool of s.hitPools) {
        const picks = pickTargetsForPool(s, working, pool, priorityList)
        for (const id of picks) {
          const idx = working.indexOf(id)
          if (idx === -1) continue
          working.splice(idx, 1)
          if (trackDestroyed) destroyedIds.push(id)
        }
      }
      s.participatingUnits = working.join('') as UnitIdList
    }

    s.hitPools = []
    s._hitPoolsShared = false

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
    ensureHitPoolsOwned(s)
    s.hitPools.push({ hits: [0, hits], validTargets })
  }

  /** Add a hit pool from a combat dice-roll outcome (hits in base slot). */
  static addBaseHits(
    s: SideStateData,
    hits: number,
    validTargets: UnitType[],
  ): void {
    if (hits <= 0) return
    ensureHitPoolsOwned(s)
    s.hitPools.push({ hits: [hits, 0], validTargets })
  }

  /** Reduce pending hits from hit pools (reduces bonus first, then base).
   *  Replaces mutated pool entries with new objects so pool refs shared
   *  with other branches (via CoW hitPools sharing) stay untouched. */
  static reduceHits(s: SideStateData, amount: number): void {
    if (s.hitPools.length === 0 || amount <= 0) return
    ensureHitPoolsOwned(s)
    let remaining = amount
    for (let i = 0; i < s.hitPools.length; i++) {
      const pool = s.hitPools[i]
      const total = pool.hits[0] + pool.hits[1]
      const reduce = Math.min(remaining, total)
      const bonusReduce = Math.min(reduce, pool.hits[1])
      const baseReduce = reduce - bonusReduce
      s.hitPools[i] = {
        ...pool,
        hits: [pool.hits[0] - baseReduce, pool.hits[1] - bonusReduce],
      }
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

  /** Modify per-unit mutable state. Replaces the entry (rather than
   *  mutating in place) because entry refs may be shared across branches
   *  under CoW — the outer record clone from `ensureUnitStateOwned`
   *  is shallow.
   *
   *  Does NOT mark `_needsCanonicalize` — most state mutations either
   *  (a) preserve the bijection (e.g. SUSTAIN damages the tail unit,
   *  which is already the lowest pool-ID), or (b) happen mid-step where
   *  the in-flight identity matters more than the canonical layout.
   *  Abilities that genuinely need re-canonicalization (currently only
   *  Duranium) call `SideApi.resortUnits()` explicitly, mirroring the
   *  prior `_needsResort` callsite. */
  static modifyUnitState(
    s: SideStateData,
    unitId: UnitId,
    updates: Partial<UnitState>,
  ): void {
    ensureUnitStateOwned(s)
    const existing = s.unitState[unitId]
    if (updates.isDamaged === false && !existing?.usedSustainThisRound) {
      delete s.unitState[unitId]
    } else {
      s.unitState[unitId] = existing
        ? { ...existing, ...updates }
        : { ...updates }
    }
  }

  /** Add a subtype to the given unit. Returns the new variant key on change,
   *  or undefined if the unit isn't tracked. The subtype is appended even if
   *  already present, producing a duplicated-subtype variant key — callers
   *  that want to skip duplicates should check first.
   *  Callers refresh engine bindings (invoke buckets, sort order) using the
   *  returned key. */
  static addSubtype(
    s: SideStateData,
    unitId: UnitId,
    subtype: UnitVariantId,
  ): UnitType | undefined {
    const sourceKey = s.unitType[unitId]
    if (!sourceKey) return undefined
    const { type, subtypes: currentSubtypes } = parseVariantId(sourceKey)

    const newSubtypes = [...currentSubtypes, subtype].sort()
    const newKey = makeVariantId(type, newSubtypes as UnitVariantId[])

    s.unitType = { ...s.unitType, [unitId]: newKey }
    s._resolvedRestrictions = undefined

    if (!s.unitStats[newKey]) {
      const parentStats =
        resolveUnitStats(s.unitStats, sourceKey) ??
        resolveUnitStats(s.unitStats, type)
      if (parentStats) {
        s.unitStats = { ...s.unitStats, [newKey]: { ...parentStats } }
      }
    }

    return newKey
  }

  /** Remove a subtype from the given unit. No-op if the unit doesn't have it. */
  static removeSubtype(
    s: SideStateData,
    unitId: UnitId,
    subtype: UnitVariantId,
  ): void {
    const sourceKey = s.unitType[unitId]
    if (!sourceKey) return
    const { type, subtypes: sourceSubs } = parseVariantId(sourceKey)
    if (!sourceSubs.includes(subtype)) return

    const newSubtypes = sourceSubs.filter(sub => sub !== subtype)
    const newKey: UnitType =
      newSubtypes.length > 0 ? makeVariantId(type, newSubtypes) : type
    if (newKey === sourceKey) return

    s.unitType = { ...s.unitType, [unitId]: newKey }
    s._resolvedRestrictions = undefined
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
    const bucketize = (pool: UnitIdList) => {
      for (const id of pool) {
        const unitId = id as UnitId
        const vKey = s.unitType[unitId]
        if (isVariantKey) {
          if (vKey !== key) continue
        } else {
          if (parseVariantId(vKey).type !== type) continue
        }
        let bucket = buckets.get(vKey)
        if (!bucket) buckets.set(vKey, (bucket = []))
        bucket.push(unitId)
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
   *  type's participating status. `gen` (typically the parent CombatStateData)
   *  owns the codepoint counter so freshly minted IDs never collide across
   *  sides. */
  static placeUnits(
    s: SideStateData,
    mode: CombatMode,
    unitsToAdd: Partial<Record<UnitType, number>>,
    gen: { _nextCode?: number },
  ): Record<UnitType, UnitId[]> {
    const placed: Record<UnitType, UnitId[]> = {} as Record<UnitType, UnitId[]>
    const participatingTypes = new Set(
      CombatSideState.getParticipatingUnitTypes(s, mode),
    )

    let nextPart = s.participatingUnits
    let nextNon = s.nonParticipatingUnits
    let nextUnitType = s.unitType

    for (const [variantKey, count] of Object.entries(unitsToAdd)) {
      const vKey = variantKey as UnitType
      if (!count || count <= 0) continue

      const baseType = parseVariantId(vKey).type as UnitBaseType

      let existing = 0
      for (const id of s.participatingUnits) {
        if (parseVariantId(s.unitType[id]).type === baseType) existing++
      }
      for (const id of s.nonParticipatingUnits) {
        if (parseVariantId(s.unitType[id]).type === baseType) existing++
      }

      const limit = UNIT_LIMITS[baseType]
      if (existing + count > limit) {
        console.warn(
          `Unit limit exceeded: ${baseType} has a maximum of ${limit}`,
        )
      }
      const allowed = Math.min(count, limit - existing)
      if (allowed <= 0) continue

      const newIds = nextUnitIds(allowed, gen)
      if (participatingTypes.has(baseType)) {
        nextPart = (nextPart + newIds.join('')) as UnitIdList
      } else {
        nextNon = (nextNon + newIds.join('')) as UnitIdList
      }
      const typeMapAdditions: Record<UnitId, UnitType> = {}
      for (const id of newIds) typeMapAdditions[id] = vKey
      nextUnitType = { ...nextUnitType, ...typeMapAdditions }

      // Stats for vKey are pre-populated by buildSideState; if missing
      // (test fixtures bypassing declareSubtype), seed an empty record so
      // resolveUnitStats can fall back to the parent.
      if (!s.unitStats[vKey]) {
        s.unitStats[vKey] = {}
      }

      placed[vKey] = newIds
    }

    s.participatingUnits = nextPart
    s.nonParticipatingUnits = nextNon
    s.unitType = nextUnitType
    s._resolvedRestrictions = undefined

    return placed
  }

  // ==========================================================================
  // RESTRICTIONS (mutations)
  // ==========================================================================

  static addRestriction(
    state: CombatStateData,
    side: CombatSide,
    layer: 'lost' | 'cannotBeUsed',
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ): void {
    const s = state[side]
    const isCategory = target !== undefined && target in UNIT_CATEGORIES
    s.unitAbilityRestrictions = addRestrictionEntry(
      s.unitAbilityRestrictions,
      layer,
      ability,
      reason,
      isCategory ? undefined : (target as UnitBaseType),
      isCategory ? (target as UnitCategory) : undefined,
    )
    // Cascade crosses sides — drop both caches.
    invalidateResolvedRestrictions(state)
  }

  static removeRestriction(
    state: CombatStateData,
    side: CombatSide,
    layer: 'lost' | 'cannotBeUsed',
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ): void {
    const s = state[side]
    const isCategory = target !== undefined && target in UNIT_CATEGORIES
    s.unitAbilityRestrictions = removeRestrictionEntry(
      s.unitAbilityRestrictions,
      layer,
      ability,
      reason,
      isCategory ? undefined : (target as UnitBaseType),
      isCategory ? (target as UnitCategory) : undefined,
    )
    invalidateResolvedRestrictions(state)
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
      // UnitId is a single-char packed token; any longer string is a variant key.
      if (target.length === 1) {
        list.push({ ...base, unitId: target as UnitId })
      } else {
        list.push({ ...base, unitType: target })
      }
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
