import type { Ability } from '../../../combat/abilities/types'

export const rickarRickani: Ability = {
  key: 'RICKAR_RICKANI',
  name: '(Winnu) Rickar Rickani',
  category: 'COMMANDER',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (_ctx, _params, dice) => {
        dice.own.modifyHitValue(-2)
      },
    },
  ],
}
