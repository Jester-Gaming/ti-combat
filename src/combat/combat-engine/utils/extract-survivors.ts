import type { UnitId } from '@/types'

import type { SideStateData } from '../../combat-state/types'
import type { SurvivorSide } from '../../types'
import { parseVariantId } from '../../utils/unit-variant'

/**
 * Extract survivors from compact state. Includes both participating and
 * non-participating units — an alive non-participating ship after ground
 * combat is still a survivor. Called once per unique outcome (not per
 * leaf) for lazy extraction.
 */
export function extractSurvivors(sideState: SideStateData): SurvivorSide {
  const survivors: SurvivorSide = {}

  const collect = (pool: UnitId[]) => {
    for (const id of pool) {
      const key = sideState.unitType[id]
      if (!key) continue

      const { type, subtypes } = parseVariantId(key)

      if (!survivors[type]) {
        survivors[type] = []
      }

      const us = sideState.unitState[id]
      survivors[type]!.push({
        isDamaged: us?.isDamaged,
        subtypes: subtypes.length ? subtypes : undefined,
      })
    }
  }
  collect(sideState.participatingUnits)
  collect(sideState.nonParticipatingUnits)

  return survivors
}
