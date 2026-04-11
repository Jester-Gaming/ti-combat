import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitType } from '@/types'

type Params = {
  targetPriority: UnitType[]
}

export const dimensionalSplicer: Ability<Params> = {
  key: 'DIMENSIONAL_SPLICER',
  name: 'Dimensional Splicer',
  description:
    "At the start of a space combat in a system that contains a wormhole and 1 or more of your ships, you may produce 1 hit and assign it to 1 of your opponent's ships.",
  category: 'FACTION',
  subcategory: 'TECHNOLOGY',
  context: 'SPACE',
  paramsSchema: z.object({
    targetPriority: z.array(z.string()),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    targetPriority: declareParam({
      default: [],
      source: 'ships',
      side: 'opponent',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => {
        return (
          ctx.api.opponent.findUnitByPriority(params.targetPriority) !==
          undefined
        )
      },
      call: (ctx, params) => {
        const target = ctx.api.opponent.findUnitByPriority(
          params.targetPriority,
        )!
        const type = ctx.api.opponent.getUnitBaseType(target)!

        ctx.api.opponent.addHits(1, [type])
      },
    },
  ],
  uiConfig: ctx => {
    return [
      {
        key: 'targetPriority' as const,
        type: 'order-list' as const,
        items: ctx.api.opponent.getUnitVariantsOptions({
          combatMode: 'SPACE',
        }),
      },
    ]
  },
}
