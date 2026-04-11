import type { Ability } from '@/combat'
import { SHIPS } from '@/constants/units'

export const vanHauge: Ability = {
  key: 'VAN_HAUGE',
  name: 'Van Hauge',
  description: 'When this ship is destroyed, destroy all ships in this system.',
  category: 'FACTION',
  subcategory: 'FLAGSHIP',
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
          while (ctx.api.own.hasUnitType(type)) ctx.api.own.destroyUnit(type)
          while (ctx.api.opponent.hasUnitType(type))
            ctx.api.opponent.destroyUnit(type)
        }
      },
    },
  ],
}
