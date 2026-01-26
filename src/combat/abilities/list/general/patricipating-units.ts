import type { UnitType } from '@/types'

import type { Ability } from '../../types'

type Params = {
  space: UnitType[]
  ground: UnitType[]
}

export const participatingUnits: Ability<Params> = {
  key: 'PARTICIPATING_UNITS',
  name: 'Participating units list',
  category: 'GENERAL',
  defaultCollapsed: true,
  defaultParams: {
    space: [
      'FLAGSHIP',
      'WAR_SUN',
      'DREADNOUGHT',
      'CARRIER',
      'CRUISER',
      'DESTROYER',
      'FIGHTER',
    ],
    ground: ['MECH', 'INFANTRY'],
  },
  invoke: [],
}
