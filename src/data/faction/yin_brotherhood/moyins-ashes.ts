import type { Ability } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'

export const moyinsAshes: Ability = {
  key: 'MOYINS_ASHES',
  name: "Moyin's Ashes",
  category: 'FACTION',
  subcategory: 'MECH',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'WHEN_INDOCTRINATION',
      side: 'OWN',
      isCallable: (_params, ctx) => {
        return ctx.api.own.countUnits('MECH') < UNIT_LIMITS.MECH
      },
      call: (ctx, _params, placedId) => {
        ctx.api.own.removeUnit(placedId)
        ctx.api.own.placeUnits({ MECH: 1 })
      },
    },
  ],
}
