import { UNIT_LIMITS } from '@/constants/units'
import type { UnitBaseType, UnitType } from '@/types'

import type { SideStateData } from '../combat-state/types'
import { parseVariantId } from '../utils/unit-variant'

export type ParamLimit = 'UNIT_LIMIT' | 'IN_COMBAT' | 'EXTRA'

/** Count units on `s` whose variant key shares `baseType`. Walks both
 *  participating and non-participating ids. Subtypes (e.g. CRUISER:Cavalry)
 *  pool under their base. */
export function countUnitsByBaseType(
  s: SideStateData,
  baseType: UnitBaseType,
): number {
  let n = 0
  for (const id of s.participatingUnits) {
    const key = s.unitType[id]
    if (!key) continue
    if (parseVariantId(key).type === baseType) n += 1
  }
  for (const id of s.nonParticipatingUnits) {
    const key = s.unitType[id]
    if (!key) continue
    if (parseVariantId(key).type === baseType) n += 1
  }
  return n
}

/** Per-variant cap used by both `getUnitVariantsOptions` (UI input max) and
 *  reconcile (stored-value clamp). Always returns a non-negative integer. */
export function resolveVariantLimit(
  limit: ParamLimit,
  s: SideStateData,
  variantKey: UnitType,
): number {
  const base = parseVariantId(variantKey).type
  if (limit === 'UNIT_LIMIT') return UNIT_LIMITS[base]
  const inCombat = countUnitsByBaseType(s, base)
  if (limit === 'IN_COMBAT') return inCombat
  // EXTRA: reinforcement headroom — how many more units of this base type
  // could still be added without breaching UNIT_LIMITS.
  return Math.max(0, UNIT_LIMITS[base] - inCombat)
}
