import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitBaseType } from '@/types'

type Params = {
  shipPriority: UnitBaseType[]
}

export const gravleashManeuvers: Ability<Params> = {
  key: 'GRAVLEASH_MANEUVERS',
  name: 'Gravleash Maneuvers',
  category: 'FACTION',
  subcategory: 'BREAKTHROUGH',
  context: 'SPACE',
  paramsSchema: z.object({
    shipPriority: z.array(z.string()),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    shipPriority: declareParam({
      default: [],
      source: 'ships',
      side: 'opponent',
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    return [
      {
        key: 'shipPriority' as const,
        type: 'order-list' as const,
        items: ctx.api.own.getUnitVariantsOptions({
          combatMode: 'SPACE',
        }),
      },
    ]
  },
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (ctx, params) => {
        const shipTypeCount = ctx.api.own.getActiveBaseTypes().length
        const target = ctx.api.own.findUnitByPriority(params.shipPriority)

        if (shipTypeCount > 0 && target !== undefined) {
          ctx.api.own.modifyHitValue(-shipTypeCount, target)
        }
      },
    },
  ],
}
