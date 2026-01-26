import type { UnitType } from '@/types'
import { getUnitListItems } from '@/utils/get-unit-config'

import type { Ability } from '../../types'
import { getParticipatingUnits } from '../../utils/get-participating-units'

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
    const participatingUnits = getParticipatingUnits(side)

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
