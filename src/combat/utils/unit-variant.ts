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

export function parseVariantId(id: string): {
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

export function getVariantDisplayName(id: string): string {
  const { type, subtypes } = parseVariantId(id)
  const base = UNIT_DISPLAY_NAMES[type]
  if (subtypes.length === 0) return base
  return `${base} (${subtypes.join(', ')})`
}
