import { type Ability, declareParam } from '@/combat'
import type { UnitType } from '@/types'

type Params = {
  targetPriority: UnitType[]
}

export const dimensionalSplicer: Ability<Params> = {
  key: 'DIMENSIONAL_SPLICER',
  name: 'Dimensional Splicer',
  category: 'FACTION',
  subcategory: 'TECHNOLOGY',
  context: 'SPACE',
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
        label: 'Target Priority',
        type: 'order-list' as const,
        items: ctx.api.opponent.getUnitVariantsOptions({
          combatMode: 'SPACE',
        }),
      },
    ]
  },
}
