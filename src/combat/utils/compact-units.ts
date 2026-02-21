import type {
  Unit,
  UnitBaseType,
  UnitLocator,
  UnitState,
  UnitStats,
} from '@/types'

import type { SideStateData } from '../combat-state/types'
import { makeVariantId, parseVariantId } from './unit-variant'

/** Symbol keys for locator — own properties on Unit, invisible to Object.keys/for-in */
export const LOCATOR_KEY = Symbol('lk')
export const LOCATOR_IDX = Symbol('li')

/** Cache for reconstructed unit arrays per side state + base type */
const reconstructCache = new WeakMap<SideStateData, Map<string, Unit[]>>()

/** Clear the reconstruction cache for a given side state (call after mutations) */
export function clearReconstructCache(sideState: SideStateData): void {
  reconstructCache.delete(sideState)
}

/** Reusable descriptor for symbol properties (not enumerable) */
const _symDesc: PropertyDescriptor = {
  value: undefined,
  writable: true,
  configurable: true,
}

/** Tag a reconstructed unit with its locator (uses defineProperty to bypass proxy prototypes) */
export function tagUnit(unit: Unit, locator: UnitLocator): void {
  _symDesc.value = locator.key
  Object.defineProperty(unit, LOCATOR_KEY, _symDesc)
  _symDesc.value = locator.index
  Object.defineProperty(unit, LOCATOR_IDX, _symDesc)
  _symDesc.value = undefined
}

/** Get the locator for a reconstructed unit */
export function getUnitLocator(unit: Unit): UnitLocator | undefined {
  const key = (unit as Record<symbol, unknown>)[LOCATOR_KEY] as
    | string
    | undefined
  const index = (unit as Record<symbol, unknown>)[LOCATOR_IDX] as
    | number
    | undefined
  if (key !== undefined && index !== undefined) return { key, index }
  return undefined
}

/** Reusable property descriptor to avoid allocations */
const _desc: PropertyDescriptor = {
  value: undefined,
  writable: true,
  enumerable: true,
  configurable: true,
}

/** Set an own property bypassing prototype chain (works with frozen/proxy prototypes) */
export function defOwn(obj: object, key: string, value: unknown): void {
  _desc.value = value
  Object.defineProperty(obj, key, _desc)
  _desc.value = undefined
}

/**
 * Resolve a unitStats entry to concrete UnitStats.
 * If the entry is a factory function, applies it to the nearest parent with
 * concrete stats (tries each one-subtype-removed variant, then base type).
 */
export function resolveUnitStats(
  sideState: SideStateData,
  key: string,
): UnitStats | undefined {
  const entry = sideState.unitStats[key]
  if (!entry) return undefined
  if (typeof entry === 'function') {
    const { type, subtypes } = parseVariantId(key)
    // Try each parent variant (remove one subtype at a time)
    for (let i = 0; i < subtypes.length; i++) {
      const parentSubs = [...subtypes.slice(0, i), ...subtypes.slice(i + 1)]
      const parentKey =
        parentSubs.length > 0 ? makeVariantId(type, parentSubs) : type
      const parentEntry = sideState.unitStats[parentKey]
      if (parentEntry !== undefined && typeof parentEntry !== 'function') {
        return entry(parentEntry)
      }
    }
    // Fallback: base type
    const baseEntry = sideState.unitStats[type]
    if (baseEntry !== undefined && typeof baseEntry !== 'function') {
      return entry(baseEntry)
    }
    return undefined
  }
  return entry
}

/** Reconstruct a Unit from stats + state + variant key */
export function reconstructUnit(
  stats: UnitStats,
  state: UnitState | undefined,
  key: string,
): Unit {
  const { subtypes } = parseVariantId(key)
  const unit = Object.create(stats) as Unit
  if (state) {
    if (state.isDamaged !== undefined)
      defOwn(unit, 'isDamaged', state.isDamaged)
    if (state.usedSustainThisRound !== undefined)
      defOwn(unit, 'usedSustainThisRound', state.usedSustainThisRound)
  }
  if (subtypes.length > 0) defOwn(unit, 'subtypes', subtypes)
  return unit
}

/** Cache: units record → (baseType → sorted variant keys) */
const variantKeysCache = new WeakMap<
  Record<string, number>,
  Map<string, string[]>
>()

/** Get sorted variant keys for a base type from units record */
export function getVariantKeysForType(
  units: Record<string, number>,
  baseType: UnitBaseType,
): string[] {
  let cacheMap = variantKeysCache.get(units)
  if (cacheMap) {
    const cached = cacheMap.get(baseType)
    if (cached) return cached
  }

  const keys: string[] = []
  for (const key of Object.keys(units)) {
    if (units[key] <= 0) continue
    const { type } = parseVariantId(key)
    if (type === baseType) keys.push(key)
  }
  keys.sort()

  if (!cacheMap) {
    cacheMap = new Map()
    variantKeysCache.set(units, cacheMap)
  }
  cacheMap.set(baseType, keys)

  return keys
}

/** Total count across all variants of a base type */
export function totalCountForType(
  units: Record<string, number>,
  baseType: UnitBaseType,
): number {
  let total = 0
  for (const key of Object.keys(units)) {
    const { type } = parseVariantId(key)
    if (type === baseType) total += units[key]
  }
  return total
}

/**
 * Resolve a global index (across all variants of a base type) to a specific
 * variant key and sub-index within that variant.
 * Variant keys are sorted alphabetically. Global index = sum of counts for
 * preceding keys + sub-index.
 */
export function resolveGlobalIndex(
  sideState: SideStateData,
  baseType: UnitBaseType,
  globalIndex: number,
): { key: string; subIndex: number } {
  const keys = getVariantKeysForType(sideState.units, baseType)
  let remaining = globalIndex
  for (const key of keys) {
    const count = sideState.units[key]
    if (remaining < count) {
      return { key, subIndex: remaining }
    }
    remaining -= count
  }
  // Fallback: use base type key
  return { key: baseType, subIndex: 0 }
}

/** Convert (variant key, sub-index) to a global index across all variants of the base type */
export function toGlobalIndex(
  sideState: SideStateData,
  key: string,
  subIndex: number,
): number {
  const { type } = parseVariantId(key)
  const keys = getVariantKeysForType(sideState.units, type)
  let offset = 0
  for (const k of keys) {
    if (k === key) return offset + subIndex
    offset += sideState.units[k]
  }
  return offset + subIndex
}

/**
 * Reconstruct all Unit objects for a base type (all variants), cached per sideState.
 * Returns a flat array with global indexing.
 */
export function reconstructUnitsForType(
  sideState: SideStateData,
  baseType: UnitBaseType,
): Unit[] {
  let cacheMap = reconstructCache.get(sideState)
  if (cacheMap) {
    const cached = cacheMap.get(baseType)
    if (cached) return cached
  }

  const keys = getVariantKeysForType(sideState.units, baseType)
  const result: Unit[] = []

  for (const key of keys) {
    const count = sideState.units[key]
    const stats = resolveUnitStats(sideState, key)
    if (!stats) continue
    const stateArr = sideState.unitState[key]

    for (let i = 0; i < count; i++) {
      const state = stateArr?.[i]
      const unit = reconstructUnit(stats, state, key)
      tagUnit(unit, { key, index: i })
      result.push(unit)
    }
  }

  if (!cacheMap) {
    cacheMap = new Map()
    reconstructCache.set(sideState, cacheMap)
  }
  cacheMap.set(baseType, result)

  return result
}

/**
 * Reconstruct all units across all types as Record<UnitBaseType, Unit[]>.
 * Used for API compatibility (getUnits() with no args).
 */
export function reconstructAllUnits(
  sideState: SideStateData,
): Partial<Record<UnitBaseType, Unit[]>> {
  const result: Partial<Record<UnitBaseType, Unit[]>> = {}
  const seenTypes = new Set<UnitBaseType>()

  for (const key of Object.keys(sideState.units)) {
    if (sideState.units[key] <= 0) continue
    const { type } = parseVariantId(key)
    seenTypes.add(type)
  }

  for (const type of seenTypes) {
    const units = reconstructUnitsForType(sideState, type)
    if (units.length > 0) {
      result[type] = units
    }
  }

  return result
}

/**
 * Ensure unitState entry exists for a given key and index.
 * Lazily creates the array and fills with empty objects as needed.
 */
export function ensureUnitState(
  sideState: SideStateData,
  key: string,
  index: number,
): UnitState {
  if (!sideState.unitState[key]) {
    sideState.unitState[key] = []
  }
  const arr = sideState.unitState[key]
  while (arr.length <= index) {
    arr.push({})
  }
  return arr[index]
}
