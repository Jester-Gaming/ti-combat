import type { Ability } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'

type Params = {
  uses: number
}

export const dunlainReaper: Ability<Params> = {
  key: 'DUNLAIN_REAPER',
  name: 'Dunlain Reaper',
  description:
    'At the start of a round of ground combat, you may spend 2 resources to replace 1 of your infantry in that combat with 1 mech.',
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
        const mechCount = ctx.api.own.countUnits('MECH')
        return (
          ctx.api.own.hasUnitType('INFANTRY') && mechCount < UNIT_LIMITS.MECH
        )
      },
      call: ctx => {
        ctx.api.own.removeUnit('INFANTRY')
        ctx.api.own.placeUnits({ MECH: 1 })
      },
    },
  ],
}
