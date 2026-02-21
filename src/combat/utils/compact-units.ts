import type { UnitBaseType, UnitId, UnitStats, UnitType } from '@/types'

import type { SideStateData } from '../combat-state/types'
import { makeVariantId, parseVariantId } from './unit-variant'

/**
 * Resolve a unitStats entry to concrete UnitStats.
 * If the entry is a factory function, applies it to the nearest parent with
 * concrete stats (tries each one-subtype-removed variant, then base type).
 */
export function resolveUnitStats(
  sideState: SideStateData,
  key: UnitType,
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

/** Total count across all variants of a base type */
export function totalCountForType(
  units: Record<string, UnitId[]>,
  baseType: UnitBaseType,
): number {
  let total = 0
  for (const key of Object.keys(units)) {
    const { type } = parseVariantId(key)
    if (type === baseType) total += units[key].length
  }
  return total
}
