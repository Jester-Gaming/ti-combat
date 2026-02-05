import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const fragile: Ability<Params> = {
  key: 'FRAGILE',
  name: 'Fragile',
  category: 'FACTION',
  subcategory: 'ABILITY',
  params: {
    isEnabled: true,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params: Params) => {
        return params.isEnabled
      },
      call: (_ctx, _params: Params, dice: DiceContext) => {
        dice.own.modifyHitValue(1)
      },
    },
  ],
}
