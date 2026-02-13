import type { Ability } from '@/combat/abilities/types'
import { UNIT_LIMITS } from '@/constants/units'

type Params = {
  uses: number
}

export const dunlainReaper: Ability<Params> = {
  key: 'DUNLAIN_REAPER',
  name: 'Dunlain Reaper',
  category: 'FACTION',
  subcategory: 'MECH',
  context: 'GROUND',
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: (_params, ctx) => {
        const mechCount = ctx.api.own.getUnits('MECH').length
        return ctx.api.own.hasUnit('INFANTRY') && mechCount < UNIT_LIMITS.MECH
      },
      call: ctx => {
        ctx.api.own.removeUnit('INFANTRY')
        ctx.api.own.addUnit({ MECH: 1 })
      },
    },
  ],
}
