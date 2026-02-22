import type { Ability } from '../../../combat/abilities-engine/types'

export const assail: Ability = {
  key: 'ASSAIL',
  name: 'Assail',
  category: 'FACTION',
  subcategory: 'ABILITY',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.modifyHitValue(-1)
      },
    },
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      call: ctx => {
        ctx.api.own.modifyHitValue(-1)
      },
    },
  ],
}
