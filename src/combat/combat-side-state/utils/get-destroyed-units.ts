import type { UnitType } from '@/types'

import type { DestroyedUnit } from '../../abilities/types'
import type { SideStateData } from '../../combat-state/types'
import { reconstructUnit } from '../../utils/compact-units'
import { parseVariantId } from '../../utils/unit-variant'

export function getDestroyedUnits(
  before: SideStateData,
  after: SideStateData,
): DestroyedUnit[] {
  const destroyed: DestroyedUnit[] = []

  for (const key of Object.keys(before.units)) {
    const beforeCount = before.units[key] ?? 0
    const afterCount = after.units[key] ?? 0
    const destroyedCount = beforeCount - afterCount
    if (destroyedCount <= 0) continue

    const { type } = parseVariantId(key)
    const stats = before.unitStats[key]
    if (!stats) continue

    const stateArr = before.unitState[key]

    // Destroyed units are taken from the end (truncation convention)
    for (let i = 0; i < destroyedCount; i++) {
      const stateIndex = afterCount + i
      const state = stateArr?.[stateIndex]
      const unit = reconstructUnit(stats, state, key)
      destroyed.push({ type: type as UnitType, unit })
    }
  }

  return destroyed
}
