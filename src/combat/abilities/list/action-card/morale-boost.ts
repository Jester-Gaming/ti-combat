import type { Ability, DiceContext } from '../../types'

type Params = {
  uses: number
}

export const moraleBoost: Ability<Params> = {
  key: 'MORALE_BOOST',
  name: 'Morale Boost',
  category: 'ACTION_CARD',
  defaultParams: {
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params: Params) => {
        return params.uses > 0
      },
      call: (ctx, params: Params, dice: DiceContext) => {
        dice.own.modifyHitValue(-1)
        ctx.api.own.updateAbilityConfig({ uses: params.uses - 1 })
      },
    },
  ],
}
