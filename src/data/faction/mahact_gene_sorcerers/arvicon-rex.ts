import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const arviconRex: Ability<Params> = {
  key: 'ARVICON_REX',
  name: '(Mahact) Arvicon Rex',
  category: 'FACTION',
  defaultParams: {
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
        dice.own.modifyHitValue(-2, 'FLAGSHIP')
      },
    },
  ],
}
