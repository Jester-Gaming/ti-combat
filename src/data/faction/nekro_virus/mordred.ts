import type { Ability } from '../../../combat/abilities/types'

export const mordred: Ability = {
  key: 'MORDRED',
  name: 'Mordred',
  category: 'FACTION',
  subcategory: 'MECH',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (ctx, _params, dice) => {
        dice.own.modifyHitValue(-2, ctx.getUnit())
      },
    },
  ],
}
