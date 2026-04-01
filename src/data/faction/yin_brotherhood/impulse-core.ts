import { z } from 'zod/mini'

import { type Ability, declareParam, parseVariantId } from '@/combat'
import type { UnitType } from '@/types'

type Params = {
  sacrificePriority: UnitType[]
  targetPriority: UnitType[]
}

const SACRIFICE_TYPES = new Set(['CRUISER', 'DESTROYER'])

export const impulseCore: Ability<Params> = {
  key: 'IMPULSE_CORE',
  name: 'Impulse Core',
  category: 'FACTION',
  subcategory: 'TECHNOLOGY',
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
      source: 'nonFighterShips',
      side: 'opponent',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
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
        const target = ctx.api.opponent.findUnitByPriority(
          params.targetPriority,
        )
        if (!sacrifice || !target) return

        ctx.api.opponent.addHits(1, [ctx.api.opponent.getUnitVariant(target)!])
        ctx.api.own.destroyUnit(sacrifice)
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
          exclude: ['FIGHTER'],
          combatMode: 'SPACE',
        }),
      },
    ]
  },
}
