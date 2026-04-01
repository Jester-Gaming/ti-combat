import { z } from 'zod/mini'

import { type Ability, declareParam, parseVariantId } from '@/combat'
import type { UnitType } from '@/types'

type Params = {
  sacrificePriority: UnitType[]
  targetPriority: UnitType[]
}

const SACRIFICE_TYPES = new Set(['CRUISER', 'DESTROYER'])

export const devotion: Ability<Params> = {
  key: 'DEVOTION',
  name: 'Devotion',
  category: 'FACTION',
  subcategory: 'ABILITY',
  context: 'SPACE',
  paramsSchema: z.object({
    sacrificePriority: z.array(z.string()),
    targetPriority: z.array(z.string()),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    sacrificePriority: declareParam({
      default: [],
      source: 'ships',
      side: 'own',
      filter: id => SACRIFICE_TYPES.has(parseVariantId(id).type),
    }),
    targetPriority: declareParam({
      default: [],
      source: 'ships',
      side: 'opponent',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'END_OF_COMBAT_ROUND',
      isCallable: (params, ctx) => {
        const sacrifice = ctx.api.own.findUnitByPriority(
          params.sacrificePriority,
        )
        if (sacrifice === undefined) return false
        return (
          ctx.api.opponent.findUnitByPriority(params.targetPriority) !==
          undefined
        )
      },
      call: (ctx, params) => {
        const sacrifice = ctx.api.own.findUnitByPriority(
          params.sacrificePriority,
        )
        if (sacrifice === undefined) return

        for (const variantId of params.targetPriority) {
          if (ctx.api.opponent.findUnitByPriority([variantId]) !== undefined) {
            ctx.api.opponent.addHits(1, [parseVariantId(variantId).type])
            ctx.api.own.destroyUnit(sacrifice)
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
        type: 'priority-list' as const,
        items: ctx.api.own.getUnitVariantsOptions({
          include: ['CRUISER', 'DESTROYER'],
          combatMode: 'SPACE',
        }),
      },
      {
        key: 'targetPriority' as const,
        label: 'Target Priority',
        type: 'priority-list' as const,
        items: ctx.api.opponent.getUnitVariantsOptions({
          combatMode: 'SPACE',
        }),
      },
    ]
  },
}
