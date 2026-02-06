import type { Ability } from '../../../combat/abilities/types'

export const arviconRex: Ability = {
  key: 'ARVICON_REX',
  name: '(Mahact) Arvicon Rex',
  category: 'FACTION',
  subcategory: 'UNIT',
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
