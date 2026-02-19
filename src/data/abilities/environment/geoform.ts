import type { UnitLocator } from '@/types'

import type { Ability } from '../../../combat/abilities/types'

export const geoform: Ability = {
  key: 'GEOFORM',
  name: 'Geoform',
  category: 'ENVIRONMENT',
  side: 'defender',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      call: (_ctx, _params, dice) => {
        dice.own.addDiceGroup('GEOFORM', {} as UnitLocator, [5, 3])
      },
    },
  ],
}
