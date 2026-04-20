import type { CombatSide, UnitBaseType, UnitId, UnitType } from '@/types'

import type { SavedRetreatData } from '../../../data/abilities/general/retreat'
import type { AbilitiesConfig, SideStateData } from '../../combat-state/types'
import type { SurvivorSide } from '../../types'
import { parseVariantId } from '../../utils/unit-variant'

/**
 * Extract survivors from compact state, filtering by participating units.
 * Called once per unique outcome (not per leaf) for lazy extraction.
 */
export function extractSurvivors(
  sideState: SideStateData,
  participatingUnits: ReadonlySet<UnitBaseType>,
): SurvivorSide {
  const survivors: SurvivorSide = {}

  for (const key in sideState.units) {
    const ids = sideState.units[key as UnitType]
    if (!ids || ids.length <= 0) continue

    const { type, subtypes } = parseVariantId(key as UnitType)
    if (!participatingUnits.has(type)) continue

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

/**
 * Merge retreat-saved units into a survivor side.
 * Called AFTER determineWinner so retreated units don't affect the outcome.
 */
export function mergeRetreatSurvivors(
  survivors: SurvivorSide,
  abilities: AbilitiesConfig,
  side: CombatSide,
): void {
  const retreatConfig = abilities[side]?.['RETREAT'] as
    | Record<string, unknown>
    | undefined
  const saved = retreatConfig?._saved as SavedRetreatData | undefined
  if (!saved) return

  for (const [key, ids] of Object.entries(saved.savedUnits)) {
    const { type, subtypes } = parseVariantId(key as UnitType)
    if (!survivors[type]) survivors[type] = []
    for (const id of ids as unknown as UnitId[]) {
      const us = saved.savedUnitState[id as unknown as number]
      survivors[type]!.push({
        isDamaged: us?.isDamaged,
        subtypes: subtypes.length ? subtypes : undefined,
      })
    }
  }
}
