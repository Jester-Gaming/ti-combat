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
        if (sacrifice === undefined) return

        ctx.api.own.destroyUnit(sacrifice)

        for (const variantId of params.targetPriority) {
          if (ctx.api.opponent.findUnitByPriority([variantId]) !== undefined) {
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
          exclude: ['FIGHTER'],
          combatMode: 'SPACE',
        }),
      },
    ]
  },
}
