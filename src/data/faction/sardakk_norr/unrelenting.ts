import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const unrelenting: Ability<Params> = {
  key: 'UNRELENTING',
  name: 'Unrelenting',
  category: 'FACTION',
  defaultParams: {
    isEnabled: true,
  },
  enableUI: true,
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params: Params) => {
        return params.isEnabled
      },
      call: (_ctx, _params: Params, dice: DiceContext) => {
        dice.own.modifyHitValue(-1)
      },
    },
  ],
}
