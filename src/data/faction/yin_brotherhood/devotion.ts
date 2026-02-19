import { declareParam } from '@/combat/abilities/declare-param'
import type { Ability } from '@/combat/abilities/types'
import { getUnitLocator } from '@/combat/utils/compact-units'
import { parseVariantId } from '@/combat/utils/unit-variant'

type Params = {
  sacrificePriority: string[]
  targetPriority: string[]
}

const SACRIFICE_TYPES = new Set(['CRUISER', 'DESTROYER'])

export const devotion: Ability<Params> = {
  key: 'DEVOTION',
  name: 'Devotion',
  category: 'FACTION',
  subcategory: 'ABILITY',
  context: 'SPACE',
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
        if (!sacrifice) return false
        return (
          ctx.api.opponent.findUnitByPriority(params.targetPriority) !==
          undefined
        )
      },
      call: (ctx, params) => {
        const sacrifice = ctx.api.own.findUnitByPriority(
          params.sacrificePriority,
        )
        if (!sacrifice) return

        for (const variantId of params.targetPriority) {
          if (ctx.api.opponent.findUnitByPriority([variantId])) {
            ctx.api.own.destroyUnit(getUnitLocator(sacrifice)!)
            ctx.api.opponent.addHits(1, [parseVariantId(variantId).type])
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
