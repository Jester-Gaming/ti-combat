import type { UnitType } from '@/types'

import { parseVariantId } from '../utils/unit-variant'

/** Sort `validTargets` (meta-level target restriction, usually base types)
 *  by `priorityList` (variant keys in cheapest-first order). Entries
 *  absent from the priority list go to the tail in their original order.
 *  The result is the `unitPriority` field of a unit-ability custom
 *  hit-pool entry: walking it from head to tail picks the cheapest
 *  eligible variant first. */
export function sortValidTargetsByPriority(
  validTargets: readonly UnitType[],
  priorityList: readonly UnitType[] | undefined,
): UnitType[] {
  if (!priorityList || priorityList.length === 0) return [...validTargets]
  const rank = (target: UnitType): number => {
    for (let i = 0; i < priorityList.length; i++) {
      const v = priorityList[i]
      if (v === target) return i
      if ((parseVariantId(v).type as UnitType) === target) return i
    }
    return Infinity
  }
  return [...validTargets].sort((a, b) => rank(a) - rank(b))
}
