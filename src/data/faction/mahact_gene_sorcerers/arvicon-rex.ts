import type { Ability } from '../../../combat/abilities/types'

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
      isCallable: params => {
        return params.isEnabled
      },
      call: (ctx, _params, dice) => {
        dice.own.modifyHitValue(-2, ctx.getUnit())
      },
    },
  ],
}
