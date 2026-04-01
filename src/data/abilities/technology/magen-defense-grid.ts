import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitBaseType } from '@/types'

type Params = {
  targetPriority: UnitBaseType[]
}

export const magenDefenseGrid: Ability<Params> = {
  key: 'MAGEN_DEFENSE_GRID',
  name: 'Magen Defense Grid',
  category: 'TECHNOLOGY',
  context: 'GROUND',
  side: 'defender',
  paramsSchema: z.object({
    targetPriority: z.array(z.string()),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    targetPriority: declareParam({
      default: [],
      source: 'groundForces',
      side: 'opponent',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => {
        const { structures } = ctx.api.own.getAbilityConfig('SETTINGS')
        const hasStructure = ctx.api.own.countUnits(structures) > 0
        if (!hasStructure) return false
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
          combatMode: 'GROUND',
        }),
      },
    ]
  },
}
