import type { UnitId } from '@/types'

import type { Ability } from '../../../combat/abilities/types'

export const metaliVoidArmaments: Ability = {
  key: 'METALI_VOID_ARMAMENTS',
  name: 'Metali Void Armaments',
  category: 'RELIC',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'AFB',
      call: (_ctx, _params, dice) => {
        dice.own.addDiceGroup('METALI_VOID_ARMAMENTS', 0 as UnitId, [6, 3])
      },
    },
  ],
}
