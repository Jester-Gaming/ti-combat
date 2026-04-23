import type { UnitType } from '@/types'

import type { SideStateData } from '../../combat-state/types'
import type { SurvivorSide } from '../../types'
import { parseVariantId } from '../../utils/unit-variant'

/**
 * Extract survivors from compact state, filtering by participating units.
 * Called once per unique outcome (not per leaf) for lazy extraction.
 */
export function extractSurvivors(sideState: SideStateData): SurvivorSide {
  const survivors: SurvivorSide = {}

  for (const key in sideState.units) {
    const ids = sideState.units[key as UnitType]
    if (!ids || ids.length <= 0) continue

    const { type, subtypes } = parseVariantId(key as UnitType)

    if (!survivors[type]) {
      survivors[type] = []
    }

    for (const id of ids) {
      const us = sideState.unitState[id]
      survivors[type]!.push({
        isDamaged: us?.isDamaged,
        subtypes: subtypes.length ? subtypes : undefined,
      })
    }
  }

  return survivors
}
