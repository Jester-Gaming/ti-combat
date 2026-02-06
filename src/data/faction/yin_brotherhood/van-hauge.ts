import type { Ability } from '@/combat/abilities/types'
import { SHIPS } from '@/constants/units'

type Params = {
  isEnabled: boolean
}

export const vanHauge: Ability<Params> = {
  key: 'VAN_HAUGE',
  name: 'Van Hauge',
  category: 'FACTION',
  subcategory: 'UNIT',
  context: 'SPACE',
  params: {
    isEnabled: true,
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
