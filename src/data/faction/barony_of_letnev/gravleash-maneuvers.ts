import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  shipPriority: UnitList
}

export const gravleashManeuvers: Ability<Params> = {
  key: 'GRAVLEASH_MANEUVERS',
  name: 'Gravleash Maneuvers',
  description:
    "Before you roll dice during space combat, apply +X to the results of 1 of your ship's rolls, where X is the number of ship types you have in the combat.",
  context: 'SPACE',
  paramsSchema: z.object({
    shipPriority: UnitListSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    shipPriority: declareParam<UnitList>({
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
        type: 'unit-list' as const,
        mode: 'order' as const,
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
        const target = ctx.api.own.findUnitByPriority(
          ctx.utils.getFlat(params.shipPriority),
        )

        if (shipTypeCount > 0 && target !== undefined) {
          ctx.api.own.modifyHitValue(-shipTypeCount, target)
        }
      },
    },
  ],
}
