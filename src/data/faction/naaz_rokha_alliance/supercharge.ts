import type { Ability } from '../../../combat/abilities-engine/types'

export const supercharge: Ability = {
  key: 'SUPERCHARGE',
  name: 'Supercharge',
  category: 'FACTION',
  subcategory: 'TECHNOLOGY',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.modifyHitValue(-1)
      },
    },
  ],
}
