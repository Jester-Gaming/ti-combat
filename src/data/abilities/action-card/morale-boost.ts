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
      timing: 'BEFORE_DICE_ROLL',
      call: (_ctx, _params, dice) => {
        dice.own.modifyHitValue(-1)
      },
    },
  ],
}
