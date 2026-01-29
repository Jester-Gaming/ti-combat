import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const arozHollow: Ability<Params> = {
  key: 'AROZ_HOLLOW',
  name: '(Obsidian) Aroz Hollow',
  category: 'COMMANDER',
  defaultParams: {
    isEnabled: false,
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
