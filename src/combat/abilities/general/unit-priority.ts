import type { UnitType } from '@/types'
import { UNIT_LIST_ITEMS } from '@/utils/get-unit-config'

import type { Ability } from '../types'

type Params = {
  unitPriority: UnitType[]
}

export const unitPriority: Ability<Params> = {
  key: 'UNIT_PRIORITY',
  name: 'Assign Hits Order',
  category: 'GENERAL',
  defaultCollapsed: true,
  params: {
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
  uiConfig: [
    {
      key: 'unitPriority',
      label: 'Unit Priority',
      type: 'order-list',
      items: UNIT_LIST_ITEMS,
    },
  ],
}
