import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
  uses: number
}

export const supercharge: Ability<Params> = {
  key: 'SUPERCHARGE',
  name: 'Supercharge',
  category: 'FACTION',
  defaultParams: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params: Params) => {
        return params.isEnabled && params.uses > 0
      },
      call: (ctx, params: Params, dice: DiceContext) => {
        dice.own.modifyHitValue(-1)
        ctx.api.own.updateAbilityConfig({ uses: params.uses - 1 })
      },
    },
  ],
}
