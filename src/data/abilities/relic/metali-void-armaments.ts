import type { Unit } from '@/types'

import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const metaliVoidArmaments: Ability<Params> = {
  key: 'METALI_VOID_ARMAMENTS',
  name: 'Metali Void Armaments',
  category: 'RELIC',
  context: 'SPACE',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'AFB',
      isCallable: (params: Params) => params.isEnabled,
      call: (_ctx, _params: Params, dice: DiceContext) => {
        dice.own.addDiceGroup('METALI_VOID_ARMAMENTS', {} as Unit, [6, 3])
      },
    },
  ],
}
