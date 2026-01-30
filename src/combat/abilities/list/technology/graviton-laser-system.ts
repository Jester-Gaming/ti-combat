import type { UnitType } from '@/types'

import type { Ability } from '../../types'

type Params = {
  isEnabled: boolean
}

const NON_FIGHTER_SHIPS: UnitType[] = [
  'FLAGSHIP',
  'WAR_SUN',
  'DREADNOUGHT',
  'CARRIER',
  'CRUISER',
  'DESTROYER',
]

export const gravitonLaserSystem: Ability<Params> = {
  key: 'GRAVITON_LASER_SYSTEM',
  name: 'Graviton Laser System',
  category: 'TECHNOLOGY',
  defaultParams: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'SPACE_CANNON_OFFENSE',
      isCallable: (params: Params) => params.isEnabled,
      call: ctx => {
        ctx.api.opponent.updateAbilityConfig('SETTINGS', {
          validTargetsSpaceCannonOffense: NON_FIGHTER_SHIPS,
        })
      },
    },
  ],
}
