import { z } from 'zod/mini'

import { type Ability, declareParam, parseVariantId } from '@/combat'
import type { UnitType } from '@/types'

type Params = {
  sacrificePriority: UnitType[]
  targetPriority: UnitType[]
}

export const impulseCore: Ability<Params> = {
  key: 'IMPULSE_CORE',
  name: 'Impulse Core',
  description:
    "At the start of a space combat, you may destroy 1 of your cruisers or destroyers in the active system to produce 1 hit against your opponent's ships; that hit must be assigned by your opponent to 1 of their non-fighter ships if able.",
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
      filter: id => {
        const SACRIFICE_TYPES = new Set(['CRUISER', 'DESTROYER'])
        return SACRIFICE_TYPES.has(parseVariantId(id).type)
      },
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
        ctx.api.own.destroyUnits(sacrifice)
      },
    },
  ],
  uiConfig: ctx => {
    return [
      {
        key: 'sacrificePriority' as const,
        label: 'Sacrifice Priority',
        type: 'checkbox-list-sortable' as const,
        items: ctx.api.own.getUnitVariantsOptions({
          include: ['CRUISER', 'DESTROYER'],
          combatMode: 'SPACE',
        }),
      },
      {
        key: 'targetPriority' as const,
        label: 'Target Priority',
        type: 'checkbox-list-sortable' as const,
        items: ctx.api.opponent.getUnitVariantsOptions({
          exclude: ['FIGHTER'],
          combatMode: 'SPACE',
        }),
      },
    ]
  },
}
