import type { Unit, UnitType } from '@/types'

import type { DestroyedUnit } from '../../abilities/types'

export function getDestroyedUnits(
  before: Partial<Record<UnitType, Unit[]>>,
  after: Partial<Record<UnitType, Unit[]>>,
): DestroyedUnit[] {
  const destroyed: DestroyedUnit[] = []

  for (const [type, beforeUnits] of Object.entries(before)) {
    if (!beforeUnits) continue
    const unitType = type as UnitType
    const afterUnits = after[unitType]
    const afterCount = afterUnits?.length ?? 0
    const destroyedCount = beforeUnits.length - afterCount

    for (let i = 0; i < destroyedCount; i++) {
      destroyed.push({ type: unitType, unit: beforeUnits[i] })
    }
  }

  return destroyed
}
