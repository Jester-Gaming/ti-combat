import type { Ability } from '../../../combat/abilities/types'

export const fighterPrototype: Ability = {
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
      timing: 'START_OF_COMBAT',
      call: ctx => {
        ctx.api.own.updateAbilityConfig({ isActive: true })
      },
    },
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'SPACE_COMBAT',
      always: true,
      isCallable: params => params.isActive === true,
      call: (_ctx, _params, dice) => {
        dice.own.modifyHitValue(-2, 'FIGHTER')
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      always: true,
      isCallable: params => params.isActive === true,
      call: ctx => {
        ctx.api.own.updateAbilityConfig({ isActive: false })
      },
    },
  ],
}
