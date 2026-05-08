import { UNIT_ABILITIES } from '@/constants/units'

import type { Ability } from '../../../combat/abilities-engine/types'

export const quietus: Ability = {
  key: 'QUIETUS',
  name: 'Quietus',
  description:
    "While this unit is in a system that contains an active breach, other players' units in systems with active breaches lose all of their unit abilities.",
  allowExternal: true,
  sync: true,
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        if (ctx.isOwner()) return
        for (const ability of UNIT_ABILITIES) {
          ctx.api.own.setUnitAbilityLost(ability, 'QUIETUS')
        }
      },
    },
    {
      timing: 'DESTROY',
      isCallable: (_params, ctx, ids) =>
        ctx.unitSource !== undefined && ids.includes(ctx.unitSource),
      call: ctx => {
        for (const ability of UNIT_ABILITIES) {
          ctx.api.opponent.removeUnitAbilityLost(ability, 'QUIETUS')
        }
      },
    },
  ],
}
