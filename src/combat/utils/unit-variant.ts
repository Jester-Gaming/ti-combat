import { UNIT_DISPLAY_NAMES } from '@/constants/units'
import type { Unit, UnitType } from '@/types'

/**
 * A variant ID is a UnitType optionally suffixed with sorted subtypes.
 * Examples: "CRUISER", "CRUISER:Cavalry", "CRUISER:Cavalry,Galvanize"
 * A plain UnitType string is a valid UnitVariantId (variant with no subtypes).
 */
export type UnitVariantId = string

export function makeVariantId(
  variantId: UnitVariantId,
  subtypes?: string[],
): UnitVariantId {
  const { type, subtypes: currentSubtypes } = parseVariantId(variantId)
  if (!subtypes || subtypes.length === 0) return type
  const sorted = [...subtypes, ...currentSubtypes].sort()
  return `${type}:${sorted.join(',')}`
}

const EMPTY_SUBTYPES: string[] = []
const parseCache = new Map<
  UnitVariantId,
  { type: UnitType; subtypes: string[] }
>()

export function parseVariantId(id: UnitVariantId): {
  type: UnitType
  subtypes: string[]
} {
  const cached = parseCache.get(id)
  if (cached) return cached

  const colonIndex = id.indexOf(':')
  let result: { type: UnitType; subtypes: string[] }
  if (colonIndex === -1) {
    result = { type: id as UnitType, subtypes: EMPTY_SUBTYPES }
  } else {
    result = {
      type: id.slice(0, colonIndex) as UnitType,
      subtypes: id.slice(colonIndex + 1).split(','),
    }
  }
  parseCache.set(id, result)
  return result
}

export function getUnitVariantId(type: UnitType, unit: Unit): UnitVariantId {
  return makeVariantId(type, unit.subtypes)
}

export function unitMatchesVariant(
  unit: Unit,
  variantId: UnitVariantId,
): boolean {
  const { subtypes } = parseVariantId(variantId)
  if (subtypes.length === 0) {
    return !unit.subtypes || unit.subtypes.length === 0
  }
  if (!unit.subtypes) return false
  if (unit.subtypes.length !== subtypes.length) return false
  return subtypes.every(s => unit.subtypes!.includes(s))
}

export function getVariantDisplayName(id: UnitVariantId): string {
  const { type, subtypes } = parseVariantId(id)
  const base = UNIT_DISPLAY_NAMES[type]
  if (subtypes.length === 0) return base
  return `${base} (${subtypes.join(', ')})`
}
