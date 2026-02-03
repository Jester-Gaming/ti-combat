import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
}

export const prophecyOfIxth: Ability<Params> = {
  key: 'PROPHECY_OF_IXTH',
  name: 'Prophecy of Ixth',
  category: 'AGENDA',
  context: 'SPACE',
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
        dice.own.modifyHitValue(-1, 'FIGHTER')
      },
    },
  ],
}
