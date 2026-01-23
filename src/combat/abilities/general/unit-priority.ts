import type { UnitType } from '@/types'
import { getUnitListItems } from '@/utils/get-unit-config'

import type { CombatSideState } from '../../state/combat-side-state'
import type { Ability } from '../types'

/** Get units that exist on the side and can participate in combat */
function getParticipatingUnitsForSide(side: CombatSideState): UnitType[] {
  const result: UnitType[] = []
  for (const [unitType, units] of Object.entries(side.units)) {
    if (units && units.length > 0) {
      result.push(unitType as UnitType)
    }
  }
  return result
}

type Params = {
  unitPriority: UnitType[]
}

export const unitPriority: Ability<Params> = {
  key: 'UNIT_PRIORITY',
  name: 'Assign Hits Order',
  category: 'GENERAL',
  defaultCollapsed: true,
  defaultParams: {
    unitPriority: [
      'FIGHTER',
      'INFANTRY',
      'DESTROYER',
      'CRUISER',
      'CARRIER',
      'DREADNOUGHT',
      'MECH',
      'WAR_SUN',
      'FLAGSHIP',
    ],
  },
  invoke: [],
  uiConfig: side => {
    const participatingUnits = getParticipatingUnitsForSide(side)

    if (participatingUnits.length < 1) {
      return []
    }

    return [
      {
        key: 'unitPriority' as const,
        label: 'Unit Priority',
        type: 'order-list' as const,
        items: getUnitListItems(participatingUnits),
      },
    ]
  },
}
