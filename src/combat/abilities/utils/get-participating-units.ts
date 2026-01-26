import { UNIT_TYPES, type UnitType } from '@/types'

import type { SideState } from '../../state/types'

/** Get units that exist on the side and can participate in combat */
export function getParticipatingUnits(side: SideState): UnitType[] {
  const result: UnitType[] = []
  for (const [unitType, units] of Object.entries(side.units)) {
    if (units && units.length > 0) {
      result.push(unitType as UnitType)
    }
  }

  if (result.length === 0) {
    return UNIT_TYPES
  }

  return result
}
