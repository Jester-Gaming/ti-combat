import type { Ability } from '@/combat/abilities/types'
import { SHIPS } from '@/constants/units'

export const vanHauge: Ability = {
  key: 'VAN_HAUGE',
  name: 'Van Hauge',
  category: 'FACTION',
  subcategory: 'UNIT',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'WHEN_DESTROY',
      call: ctx => {
        for (const type of SHIPS) {
          while (ctx.api.own.hasUnit(type)) ctx.api.own.destroyUnit(type)
          while (ctx.api.opponent.hasUnit(type))
            ctx.api.opponent.destroyUnit(type)
        }
      },
    },
  ],
}
