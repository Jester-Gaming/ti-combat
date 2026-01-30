import type { Ability, DiceContext } from '../../types'

type Params = {
  isEnabled: boolean
}

export const nebula: Ability<Params> = {
  key: 'NEBULA',
  name: 'Nebula',
  category: 'ENVIRONMENT',
  defaultParams: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  condition: { onlyDefender: true },
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
