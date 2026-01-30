import { UNIT_DISPLAY_NAMES } from '@/constants/units'
import type { Unit, UnitType } from '@/types'

/**
 * A variant ID is a UnitType optionally suffixed with sorted subtypes.
 * Examples: "CRUISER", "CRUISER:Cavalry", "CRUISER:Cavalry,Galvanize"
 * A plain UnitType string is a valid UnitVariantId (variant with no subtypes).
 */
export type UnitVariantId = string

export function makeVariantId(
  type: UnitType,
  subtypes?: string[],
): UnitVariantId {
  if (!subtypes || subtypes.length === 0) return type
  const sorted = [...subtypes].sort()
  return `${type}:${sorted.join(',')}`
}

export function parseVariantId(id: UnitVariantId): {
  type: UnitType
  subtypes: string[]
} {
  const colonIndex = id.indexOf(':')
  if (colonIndex === -1) {
    return { type: id as UnitType, subtypes: [] }
  }
  return {
    type: id.slice(0, colonIndex) as UnitType,
    subtypes: id.slice(colonIndex + 1).split(','),
  }
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
