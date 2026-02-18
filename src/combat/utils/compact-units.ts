import type { Unit, UnitState, UnitStats, UnitType } from '@/types'

import type { SideStateData } from '../combat-state/types'
import { parseVariantId } from './unit-variant'

/** Locator for a unit within compact state */
export interface UnitLocator {
  key: string
  index: number
}

/** WeakMap tag for reconstructed Unit → locator */
const unitLocatorMap = new WeakMap<Unit, UnitLocator>()

/** Cache for reconstructed unit arrays per side state + base type */
const reconstructCache = new WeakMap<SideStateData, Map<string, Unit[]>>()

/** Clear the reconstruction cache for a given side state (call after mutations) */
export function clearReconstructCache(sideState: SideStateData): void {
  reconstructCache.delete(sideState)
}

/** Tag a reconstructed unit with its locator */
export function tagUnit(unit: Unit, locator: UnitLocator): void {
  unitLocatorMap.set(unit, locator)
}

/** Get the locator for a reconstructed unit */
export function getUnitLocator(unit: Unit): UnitLocator | undefined {
  return unitLocatorMap.get(unit)
}

/** Reconstruct a Unit from stats + state + variant key */
export function reconstructUnit(
  stats: UnitStats,
  state: UnitState | undefined,
  key: string,
): Unit {
  const { subtypes } = parseVariantId(key)
  const unit: Unit = { ...stats }
  if (state) Object.assign(unit, state)
  if (subtypes.length > 0) unit.subtypes = subtypes
  return unit
}

/** Get sorted variant keys for a base type from units record */
export function getVariantKeysForType(
  units: Record<string, number>,
  baseType: UnitType,
): string[] {
  const keys: string[] = []
  for (const key of Object.keys(units)) {
    if (units[key] <= 0) continue
    const { type } = parseVariantId(key)
    if (type === baseType) keys.push(key)
  }
  keys.sort()
  return keys
}

/** Total count across all variants of a base type */
export function totalCountForType(
  units: Record<string, number>,
  baseType: UnitType,
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
  baseType: UnitType,
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
  baseType: UnitType,
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
    const stats = sideState.unitStats[key]
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
 * Reconstruct all units across all types as Record<UnitType, Unit[]>.
 * Used for API compatibility (getUnits() with no args).
 */
export function reconstructAllUnits(
  sideState: SideStateData,
): Partial<Record<UnitType, Unit[]>> {
  const result: Partial<Record<UnitType, Unit[]>> = {}
  const seenTypes = new Set<UnitType>()

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
