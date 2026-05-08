import { z } from 'zod/mini'

import { type Ability, declareParam, parseVariantId } from '@/combat'
import type { UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  sacrificePriority: UnitList<boolean>
  targetPriority: UnitList<boolean>
}

export const devotion: Ability<Params> = {
  key: 'DEVOTION',
  name: 'Devotion',
  description:
    "After each space battle round, you may destroy 1 of your cruisers or destroyers in the active system to produce 1 hit and assign it to 1 of your opponent's ships in that system.",
  context: 'SPACE',
  paramsSchema: z.object({
    sacrificePriority: UnitListBooleanSchema,
    targetPriority: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    sacrificePriority: declareParam({
      default: [] as UnitList<boolean>,
      source: 'ships',
      side: 'own',
      defaultItemValue: true,
      filter: id => {
        const SACRIFICE_TYPES = new Set(['CRUISER', 'DESTROYER'])
        return SACRIFICE_TYPES.has(parseVariantId(id).type)
      },
    }),
    targetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'ships',
      side: 'opponent',
      defaultItemValue: true,
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'END_OF_COMBAT_ROUND',
      isCallable: (params, ctx) => {
        const sacrifice = ctx.api.own.findUnitByPriority(
          ctx.utils.getFlat(params.sacrificePriority),
        )
        if (sacrifice === undefined) return false
        return (
          ctx.api.opponent.findUnitByPriority(
            ctx.utils.getFlat(params.targetPriority),
          ) !== undefined
        )
      },
      call: (ctx, params) => {
        const sacrifice = ctx.api.own.findUnitByPriority(
          ctx.utils.getFlat(params.sacrificePriority),
        )
        if (sacrifice === undefined) return

        for (const variant of ctx.utils.getFlat(params.targetPriority)) {
          if (ctx.api.opponent.findUnitByPriority([variant]) !== undefined) {
            ctx.api.opponent.addHits(1, [parseVariantId(variant).type])
            ctx.api.own.destroyUnits(sacrifice)
            return
          }
        }
      },
    },
  ],
  uiConfig: ctx => {
    return [
      {
        key: 'sacrificePriority' as const,
        label: 'Sacrifice Priority',
        type: 'unit-list' as const,
        mode: 'checkbox' as const,
        sortable: true,
        items: ctx.api.own.getUnitVariantsOptions({
          include: ['CRUISER', 'DESTROYER'],
          combatMode: 'SPACE',
        }),
      },
      {
        key: 'targetPriority' as const,
        label: 'Target Priority',
        type: 'unit-list' as const,
        mode: 'checkbox' as const,
        sortable: true,
        items: ctx.api.opponent.getUnitVariantsOptions({
          combatMode: 'SPACE',
        }),
      },
    ]
  },
}
