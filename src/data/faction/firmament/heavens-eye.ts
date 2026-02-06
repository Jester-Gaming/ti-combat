import type { Ability } from '../../../combat/abilities/types'

export const heavensEye: Ability = {
  key: 'HEAVENS_EYE',
  name: "(Firmament) Heaven's Eye",
  category: 'FACTION',
  subcategory: 'UNIT',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'END_OF_COMBAT_ROUND',
      call: ctx => {
        ctx.api.own.modifyUnit(ctx.getUnit(), { isDamaged: false })
      },
    },
  ],
}
