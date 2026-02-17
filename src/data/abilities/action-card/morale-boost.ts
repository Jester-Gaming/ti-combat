import type { Ability } from '../../../combat/abilities/types'

export const moraleBoost: Ability = {
  key: 'MORALE_BOOST',
  name: 'Morale Boost',
  category: 'ACTION_CARD',
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        ctx.api.own.updateAbilityConfig({ isActive: true })
      },
    },
    {
      timing: 'BEFORE_DICE_ROLL',
      always: true,
      isCallable: params => params.isActive === true,
      call: (_ctx, _params, dice) => {
        dice.own.modifyHitValue(-1)
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
