import type { UnitId } from '@/types'

import type { Ability } from '../../../combat/abilities-engine/types'

export const geoform: Ability = {
  key: 'GEOFORM',
  name: 'Geoform',
  description:
    'Ready Elysium and attach this card to it. It gains the Space Cannon 5 (x3) ability as if it were a unit.',
  category: 'FACTION',
  subcategory: 'HERO',
  allowExternal: true,
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
        dice.own.addDiceGroup('GEOFORM', 0 as UnitId, [5, 3])
      },
    },
  ],
}
