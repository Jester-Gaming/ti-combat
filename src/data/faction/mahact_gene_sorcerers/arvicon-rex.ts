import type { Ability } from '../../../combat/abilities/types'

export const arviconRex: Ability = {
  key: 'ARVICON_REX',
  name: 'Arvicon Rex',
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.modifyHitValue(-2, ctx.getUnit())
      },
    },
  ],
}
