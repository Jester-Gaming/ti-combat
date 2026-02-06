import type { UnitType } from '@/types'

import type { Ability } from '../../../combat/abilities/types'

const NON_FIGHTER_SHIPS: UnitType[] = [
  'FLAGSHIP',
  'WAR_SUN',
  'DREADNOUGHT',
  'CARRIER',
  'CRUISER',
  'DESTROYER',
]

export const gravitonLaserSystem: Ability = {
  key: 'GRAVITON_LASER_SYSTEM',
  name: 'Graviton Laser System',
  category: 'TECHNOLOGY',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'SPACE_CANNON_OFFENSE',
      call: ctx => {
        ctx.api.opponent.updateAbilityConfig('SETTINGS', {
          validTargetsSpaceCannonOffense: NON_FIGHTER_SHIPS,
        })
      },
    },
  ],
}
