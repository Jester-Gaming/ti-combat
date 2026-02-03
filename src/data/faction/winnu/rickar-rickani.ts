import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const rickarRickani: Ability<Params> = {
  key: 'RICKAR_RICKANI',
  name: '(Winnu) Rickar Rickani',
  category: 'COMMANDER',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params: Params) => {
        return params.isEnabled
      },
      call: (_ctx, _params: Params, dice: DiceContext) => {
        dice.own.modifyHitValue(-2)
      },
    },
  ],
}
