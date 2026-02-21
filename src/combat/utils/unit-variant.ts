import { UNIT_DISPLAY_NAMES } from '@/constants/units'
import type { Unit, UnitBaseType, UnitVariant } from '@/types'

/**
 * A variant ID is a UnitBaseType optionally suffixed with sorted subtypes.
 * Examples: "CRUISER", "CRUISER:Cavalry", "CRUISER:Cavalry,Galvanize"
 * A plain UnitBaseType string is a valid UnitVariantId (variant with no subtypes).
 */

export function makeVariantId(
  variantId: string,
  subtypes?: string[],
): UnitBaseType | UnitVariant {
  const { type, subtypes: currentSubtypes } = parseVariantId(variantId)
  if (!subtypes || subtypes.length === 0) return type
  const sorted = [...subtypes, ...currentSubtypes].sort()
  return `${type}:${sorted.join(',')}`
}

const EMPTY_SUBTYPES: string[] = []
const parseCache = new Map<string, { type: UnitBaseType; subtypes: string[] }>()

export function parseVariantId(id: string): {
  type: UnitBaseType
  subtypes: string[]
} {
  const cached = parseCache.get(id)
  if (cached) return cached

  const colonIndex = id.indexOf(':')
  let result: { type: UnitBaseType; subtypes: string[] }
  if (colonIndex === -1) {
    result = { type: id as UnitBaseType, subtypes: EMPTY_SUBTYPES }
  } else {
    result = {
      type: id.slice(0, colonIndex) as UnitBaseType,
      subtypes: id.slice(colonIndex + 1).split(','),
    }
  }
  parseCache.set(id, result)
  return result
}

export function unitMatchesVariant(unit: Unit, variantId: string): boolean {
  const { subtypes } = parseVariantId(variantId)
  if (subtypes.length === 0) {
    return !unit.subtypes || unit.subtypes.length === 0
  }
  if (!unit.subtypes) return false
  if (unit.subtypes.length !== subtypes.length) return false
  return subtypes.every(s => unit.subtypes!.includes(s))
}

export function getVariantDisplayName(id: string): string {
  const { type, subtypes } = parseVariantId(id)
  const base = UNIT_DISPLAY_NAMES[type]
  if (subtypes.length === 0) return base
  return `${base} (${subtypes.join(', ')})`
}
