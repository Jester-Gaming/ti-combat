import { UNIT_DISPLAY_NAMES } from '@/constants/units'
import type { UnitBaseType, UnitType, UnitVariantId } from '@/types'

/**
 * A variant ID is a UnitBaseType optionally suffixed with sorted subtypes.
 * Examples: "CRUISER", "CRUISER:Cavalry", "CRUISER:Cavalry,Galvanize"
 * A plain UnitBaseType string is a valid UnitVariantId (variant with no subtypes).
 */

export function makeVariantId(
  variantId: UnitType,
  subtypes?: UnitVariantId[],
): UnitType {
  if (!subtypes || subtypes.length === 0) return variantId
  const { type, subtypes: currentSubtypes } = parseVariantId(variantId)
  const sorted = [...subtypes, ...currentSubtypes].sort()
  return `${type}:${sorted.join(',')}` as UnitType
}

const EMPTY_SUBTYPES: UnitVariantId[] = []
const parseCache = new Map<
  string,
  { type: UnitBaseType; subtypes: UnitVariantId[] }
>()

export function parseVariantId(id: UnitType): {
  type: UnitBaseType
  subtypes: UnitVariantId[]
} {
  const cached = parseCache.get(id)
  if (cached) return cached

  const colonIndex = id.indexOf(':')
  let result: { type: UnitBaseType; subtypes: UnitVariantId[] }
  if (colonIndex === -1) {
    result = { type: id as UnitBaseType, subtypes: EMPTY_SUBTYPES }
  } else {
    result = {
      type: id.slice(0, colonIndex) as UnitBaseType,
      subtypes: id.slice(colonIndex + 1).split(',') as UnitVariantId[],
    }
  }
  parseCache.set(id, result)
  return result
}

/** Variant-superset match: `unitVariantId` matches `queryVariantId` when they
 *  share a base type and the unit's subtypes include every subtype required
 *  by the query. Used by `getUnits` / `hasUnitType` / etc. when called with
 *  `includeVariants: true`: querying `INFANTRY:Evelyn` matches
 *  `INFANTRY:Evelyn,Galvanized` but not `INFANTRY:Galvanized`. */
export function matchesVariantSuperset(
  unitVariantId: UnitType,
  queryVariantId: UnitType,
): boolean {
  const u = parseVariantId(unitVariantId)
  const q = parseVariantId(queryVariantId)
  if (u.type !== q.type) return false
  for (const sub of q.subtypes) {
    if (!u.subtypes.includes(sub)) return false
  }
  return true
}

export function getVariantDisplayName(id: UnitType): string {
  const { type, subtypes } = parseVariantId(id)
  const base = UNIT_DISPLAY_NAMES[type]
  if (subtypes.length === 0) return base
  return `${base} (${subtypes.join(', ')})`
}
