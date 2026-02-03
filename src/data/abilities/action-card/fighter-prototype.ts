import type { Ability, DiceContext } from '../../../combat/abilities/types'

type Params = {
  isEnabled: boolean
  uses: number
}

export const fighterPrototype: Ability<Params> = {
  key: 'FIGHTER_PROTOTYPE',
  name: 'Fighter Prototype',
  category: 'ACTION_CARD',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'SPACE_COMBAT',
      isCallable: (params: Params) => {
        return params.isEnabled && params.uses > 0
      },
      call: (ctx, params: Params, dice: DiceContext) => {
        dice.own.modifyHitValue(-2, 'FIGHTER')
        ctx.api.own.updateAbilityConfig({ uses: params.uses - 1 })
      },
    },
  ],
}
